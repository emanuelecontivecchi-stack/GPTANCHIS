import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const schemaName = process.env.ANCHISE_DB_SCHEMA ?? "anchise_control_v1";
process.env.ANCHISE_DISABLE_DESKTOP_OPEN = "1";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName)) {
  throw new Error(`Invalid ANCHISE_DB_SCHEMA value: ${schemaName}`);
}

const sql = postgres(databaseUrl, {
  prepare: false,
  connection: {
    application_name: "anchise_web_route_smoke",
    options: `-c search_path=${schemaName},public`
  }
});

function requestJson(body) {
  return new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function unwrap(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, received ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(`Expected ok payload, received ${JSON.stringify(payload)}`);
  }

  return payload.data;
}

async function unwrapFailure(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected failure status ${expectedStatus}, received ${response.status}`);
  }

  const payload = await response.json();

  if (payload.ok) {
    throw new Error(`Expected failure payload, received ${JSON.stringify(payload)}`);
  }

  return payload.error;
}

async function runCommand(command, args, errorMessage) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore"
    });

    child.on("error", (error) => {
      reject(new Error(`${errorMessage}: ${error instanceof Error ? error.message : "Unknown error"}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${errorMessage}: command exited with code ${code === null ? "unknown" : code}.`));
    });
  });
}

function quotedPowerShellLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function createArchiveFromDirectory(sourceRoot, archivePath) {
  if (process.platform === "win32") {
    await runCommand(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Compress-Archive -Path ${quotedPowerShellLiteral(
          join(sourceRoot, "*")
        )} -DestinationPath ${quotedPowerShellLiteral(archivePath)} -Force`
      ],
      "Could not create the Google archive fixture"
    );
    return;
  }

  await runCommand("tar", ["-czf", archivePath, "-C", sourceRoot, "."], "Could not create the Google archive fixture");
}

async function createGoogleExportFixture() {
  const root = await mkdtemp(join(tmpdir(), "anchise-google-export-"));
  const sourceTakeoutRoot = join(root, "source", "Takeout");
  const watchRoot = join(root, "watch");

  await mkdir(join(sourceTakeoutRoot, "Mail"), { recursive: true });
  await mkdir(join(sourceTakeoutRoot, "Google Photos", "Vacation"), { recursive: true });
  await mkdir(join(sourceTakeoutRoot, "Location History (Timeline)"), { recursive: true });
  await mkdir(watchRoot, { recursive: true });

  const mboxBody = [
    "From sender1@example.com Mon Jan 01 10:00:00 2024",
    "Date: Mon, 01 Jan 2024 10:00:00 +0000",
    "Subject: Receipt thread",
    "",
    `${"A".repeat(1900)}`,
    "",
    "From sender2@example.com Tue Feb 13 11:30:00 2024",
    "Date: Tue, 13 Feb 2024 11:30:00 +0000",
    "Subject: Family plan",
    "",
    `${"B".repeat(1900)}`
  ].join("\n");

  await writeFile(join(sourceTakeoutRoot, "Mail", "All mail Including Spam and Trash.mbox"), mboxBody);

  await writeFile(
    join(sourceTakeoutRoot, "Google Photos", "Vacation", "barcelona-roofline.jpg"),
    "P".repeat(1700)
  );
  await writeFile(
    join(sourceTakeoutRoot, "Google Photos", "Vacation", "barcelona-roofline.jpg.json"),
    JSON.stringify(
      {
        title: "Barcelona roofline",
        photoTakenTime: {
          timestamp: "1711969200"
        }
      },
      null,
      2
    )
  );

  await writeFile(join(sourceTakeoutRoot, "Google Photos", "Vacation", "night-tram.heic"), "Q".repeat(2100));
  await writeFile(
    join(sourceTakeoutRoot, "Google Photos", "Vacation", "night-tram.heic.json"),
    JSON.stringify(
      {
        title: "Night tram",
        photoTakenTime: {
          timestamp: "1725311400"
        }
      },
      null,
      2
    )
  );

  await writeFile(
    join(sourceTakeoutRoot, "Location History (Timeline)", "Records.json"),
    JSON.stringify(
      {
        timelineObjects: [
          { placeVisit: { location: "Paris" } },
          { placeVisit: { location: "Barcelona" } },
          { activitySegment: { activityType: "WALKING" } },
          { activitySegment: { activityType: "FLYING" } }
        ]
      },
      null,
      2
    )
  );

  const archivePath =
    process.platform === "win32"
      ? join(root, "google-takeout.zip")
      : join(root, "google-takeout.tar.gz");
  await createArchiveFromDirectory(join(root, "source"), archivePath);

  return { root, sourceTakeoutRoot, watchRoot, archivePath };
}

let workspaceId = null;
let closeDb = async () => {};
let exportFixtureRoot = null;

try {
  const googleExportFixture = await createGoogleExportFixture();
  exportFixtureRoot = googleExportFixture.root;

  ({ closeDb } = await import("../apps/api/dist/db.js"));
  const workspacesRoute = await import("../apps/web/dist/src/app/api/control-plane/workspaces/route.js");
  const getWorkspaceRoute = await import("../apps/web/dist/src/app/api/control-plane/workspaces/get/route.js");
  const connectorsRoute = await import("../apps/web/dist/src/app/api/control-plane/connectors/route.js");
  const listConnectorsRoute = await import("../apps/web/dist/src/app/api/control-plane/connectors/list/route.js");
  const prepareGoogleAuthRoute = await import(
    "../apps/web/dist/src/app/api/control-plane/connectors/google/prepare-auth/route.js"
  );
  const completeGoogleAuthRoute = await import(
    "../apps/web/dist/src/app/api/control-plane/connectors/google/complete-auth/route.js"
  );
  const checkGoogleExportRoute = await import(
    "../apps/web/dist/src/app/api/control-plane/connectors/google/check-export/route.js"
  );
  const advanceGoogleExportRoute = await import(
    "../apps/web/dist/src/app/api/control-plane/connectors/google/advance-export/route.js"
  );
  const importGoogleArchiveRoute = await import(
    "../apps/web/dist/src/app/api/control-plane/connectors/google/import-archive/route.js"
  );
  const openGoogleExportRootRoute = await import(
    "../apps/web/dist/src/app/api/control-plane/connectors/google/open-export-root/route.js"
  );
  const inventoryRunRoute = await import("../apps/web/dist/src/app/api/control-plane/inventory-runs/route.js");
  const importPlansRoute = await import("../apps/web/dist/src/app/api/control-plane/import-plans/route.js");
  const confirmRoute = await import("../apps/web/dist/src/app/api/control-plane/import-plans/confirm/route.js");
  const materializeRoute = await import("../apps/web/dist/src/app/api/control-plane/import-batches/materialize/route.js");
  const commitBatchRoute = await import("../apps/web/dist/src/app/api/control-plane/import-batches/commit/route.js");

  const ownerId = `web-route-smoke-${Date.now()}`;

  const workspace = await unwrap(
    await workspacesRoute.POST(
      requestJson({
        ownerId,
        planState: "trial",
        agentState: "paired",
        storageCapacityBytes: 5 * 1024
      })
    ),
    201
  );

  workspaceId = workspace.workspaceId;

  const workspaceEcho = await unwrap(
    await getWorkspaceRoute.POST(requestJson({ workspaceId })),
    200
  );

  const connector = await unwrap(
    await connectorsRoute.POST(
      requestJson({
        workspaceId,
        platform: "google",
        accountLabel: "web-route-google",
        surface: "browser_account",
        extractionStrategy: "browser",
        deleteCapability: "download_only",
        settings: {
          inventoryProfile: "google_core",
          rootPath: googleExportFixture.watchRoot
        }
      })
    ),
    201
  );

  const connectors = await unwrap(
    await listConnectorsRoute.POST(requestJson({ workspaceId })),
    200
  );

  const preparedGoogleAuth = await unwrap(
    await prepareGoogleAuthRoute.POST(requestJson({ connectorId: connector.connectorId })),
    201
  );

  const completedGoogleAuth = await unwrap(
    await completeGoogleAuthRoute.POST(
      requestJson({
        connectorId: connector.connectorId,
        sessionId: preparedGoogleAuth.session.sessionId
      })
    ),
    200
  );

  if (!completedGoogleAuth.connector.exportSession?.handoffUrl) {
    throw new Error("Expected completed Google auth to prepare an export handoff URL.");
  }

  if (!completedGoogleAuth.connector.exportSession.watchFolderReadyAt) {
    throw new Error("Expected completed Google auth to prepare the watched export folder.");
  }

  if (!completedGoogleAuth.connector.exportSession.archiveExpectation) {
    throw new Error("Expected completed Google auth to describe the export artifact.");
  }

  if ((completedGoogleAuth.connector.exportSession.orchestrationSteps?.length ?? 0) < 3) {
    throw new Error("Expected completed Google auth to provide a visible-lane export checklist.");
  }

  const openedExportRoot = await unwrap(
    await openGoogleExportRootRoute.POST(
      requestJson({
        connectorId: connector.connectorId
      })
    ),
    200
  );

  if (openedExportRoot.openedPath !== completedGoogleAuth.connector.exportSession.exportRootPath) {
    throw new Error(
      `Expected opened export root ${completedGoogleAuth.connector.exportSession.exportRootPath}, received ${openedExportRoot.openedPath}`
    );
  }

  const confirmedCategories = await unwrap(
    await advanceGoogleExportRoute.POST(
      requestJson({
        connectorId: connector.connectorId,
        action: "confirm_categories"
      })
    ),
    200
  );

  if (confirmedCategories.session.guideState !== "categories_confirmed") {
    throw new Error(
      `Expected guide state categories_confirmed, received ${confirmedCategories.session.guideState}`
    );
  }

  const createdExport = await unwrap(
    await advanceGoogleExportRoute.POST(
      requestJson({
        connectorId: connector.connectorId,
        action: "mark_export_created"
      })
    ),
    200
  );

  if (createdExport.session.guideState !== "export_requested") {
    throw new Error(
      `Expected guide state export_requested, received ${createdExport.session.guideState}`
    );
  }

  const waitingArchive = await unwrap(
    await advanceGoogleExportRoute.POST(
      requestJson({
        connectorId: connector.connectorId,
        action: "mark_waiting_for_archive"
      })
    ),
    200
  );

  if (waitingArchive.session.guideState !== "awaiting_archive") {
    throw new Error(
      `Expected guide state awaiting_archive, received ${waitingArchive.session.guideState}`
    );
  }

  const uploadFormData = new FormData();
  uploadFormData.append("connectorId", connector.connectorId);
  uploadFormData.append(
    "archive",
    new File(
      [await readFile(googleExportFixture.archivePath)],
      process.platform === "win32" ? "google-takeout.zip" : "google-takeout.tar.gz"
    )
  );

  const importedArchive = await unwrap(
    await importGoogleArchiveRoute.POST(
      new Request("http://localhost", {
        method: "POST",
        body: uploadFormData
      })
    ),
    200
  );

  if (!importedArchive.inventoryRun) {
    throw new Error("Expected Google archive import to trigger inventory automatically.");
  }

  const exportCheck = await unwrap(
    await checkGoogleExportRoute.POST(requestJson({ connectorId: connector.connectorId })),
    200
  );

  if (!exportCheck.inventoryRun) {
    throw new Error("Expected Google export check to trigger inventory automatically.");
  }

  const inventoryRun = exportCheck.inventoryRun;

  const snapshot = inventoryRun.snapshot;
  const categories = snapshot.categories.map((entry) => entry.category).sort();

  if (categories.join(",") !== ["geolocation", "mail", "photos"].join(",")) {
    throw new Error(`Expected google export categories, received ${categories.join(",")}`);
  }

  const oversizedPlan = await unwrap(
    await importPlansRoute.POST(
      requestJson({
        workspaceId,
        connectorId: connector.connectorId,
        snapshotId: snapshot.inventoryId,
        categories: snapshot.categories.map((entry) => entry.category),
        sourceAction: "download_only"
      })
    ),
    201
  );

  const blockedConfirmation = await unwrapFailure(
    await confirmRoute.POST(requestJson({ planId: oversizedPlan.planId })),
    400
  );

  if (oversizedPlan.fitState !== "exceeds") {
    throw new Error(`Expected oversized plan to exceed space, received ${oversizedPlan.fitState}`);
  }

  const selectedPlan = await unwrap(
    await importPlansRoute.POST(
      requestJson({
        workspaceId,
        connectorId: connector.connectorId,
        snapshotId: snapshot.inventoryId,
        categories: ["mail"],
        sourceAction: "download_only"
      })
    ),
    201
  );

  if (selectedPlan.fitState !== "fits") {
    throw new Error(`Expected reduced plan to fit, received ${selectedPlan.fitState}`);
  }

  const confirmedPlan = await unwrap(
    await confirmRoute.POST(requestJson({ planId: selectedPlan.planId })),
    200
  );

  const materializedBatch = await unwrap(
    await materializeRoute.POST(
      requestJson({
        planId: selectedPlan.planId,
        batchSize: 4
      })
    ),
    201
  );

  const committedBatch = await unwrap(
    await commitBatchRoute.POST(
      requestJson({
        batchId: materializedBatch.batch.batchId,
        objects: materializedBatch.sourceItems.map((item) => ({
          sourceItemId: item.sourceItemId,
          contentHash: item.contentHashHint ?? `hash-${item.sourceItemId}`,
          byteSize: item.byteSizeEstimate ?? 1,
          storedByteSize: item.byteSizeEstimate ?? 1,
          mimeType: item.mimeType ?? "application/octet-stream",
          title: item.title,
          originalAt: item.externalUpdatedAt,
          hasLocation: item.category === "geolocation",
          sourceMetadata: item.metadata
        }))
      })
    ),
    200
  );

  console.log(
    JSON.stringify(
      {
        cleanedUp: false,
        schemaName,
        workspaceId,
        workspaceEchoId: workspaceEcho.workspaceId,
        connectorCount: connectors.length,
        authState: completedGoogleAuth.connector.authState,
        authSessionStatus: completedGoogleAuth.session.status,
        exportHandoffReady: Boolean(completedGoogleAuth.connector.exportSession?.handoffUrl),
        exportChecklistSteps:
          completedGoogleAuth.connector.exportSession?.orchestrationSteps.length ?? 0,
        exportGuideState: exportCheck.session.guideState,
        watchFolderReadyAt: completedGoogleAuth.connector.exportSession?.watchFolderReadyAt,
        exportState: exportCheck.connector.exportState,
        strategyLabel: inventoryRun.strategyLabel,
        snapshotId: snapshot.inventoryId,
        categories,
        discoveredItemCount: inventoryRun.discoveredItemCount,
        oversizedPlanFitState: oversizedPlan.fitState,
        blockedConfirmationCode: blockedConfirmation.code,
        selectedPlanFitState: selectedPlan.fitState,
        confirmedStatus: confirmedPlan.status,
        batchId: materializedBatch.batch.batchId,
        batchItems: materializedBatch.sourceItems.length,
        storedObjectCount: committedBatch.storedObjectCount,
        dedupObjectCount: committedBatch.dedupObjectCount
      },
      null,
      2
    )
  );
} finally {
  if (workspaceId) {
    await sql`delete from workspaces where id = ${workspaceId}`;
    console.log(JSON.stringify({ cleanedUp: true, workspaceId }, null, 2));
  }

  if (exportFixtureRoot) {
    await rm(exportFixtureRoot, { recursive: true, force: true });
  }

  await closeDb();
  await sql.end({ timeout: 5 });
}
