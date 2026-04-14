import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const schemaName = process.env.ANCHISE_DB_SCHEMA ?? "anchise_control_v1";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName)) {
  throw new Error(`Invalid ANCHISE_DB_SCHEMA value: ${schemaName}`);
}

class RollbackPreview extends Error {
  constructor(summary) {
    super("Rolled back API smoke test after previewing the flow.");
    this.name = "RollbackPreview";
    this.summary = summary;
  }
}

function unwrap(response, expectedStatus) {
  if (response.status !== expectedStatus || !response.body.ok) {
    throw new Error(`Expected ${expectedStatus} success, received ${JSON.stringify(response)}`);
  }

  return response.body.data;
}

const sql = postgres(databaseUrl, {
  prepare: false,
  connection: {
    application_name: "anchise_control_plane_api_smoke",
    options: `-c search_path=${schemaName},public`
  }
});

try {
  const { createControlPlaneRepository } = await import("../apps/api/dist/controlPlaneRepository.js");
  const { createControlPlaneApi } = await import("../apps/api/dist/controlPlaneApi.js");

  await sql.begin(async (tx) => {
    const repository = createControlPlaneRepository(tx);
    const api = createControlPlaneApi(repository);

    const workspace = unwrap(
      await api.createWorkspace({
        ownerId: "api-smoke-owner",
        planState: "trial",
        agentState: "paired",
        storageCapacityBytes: 200 * 1024 * 1024 * 1024
      }),
      201
    );

    const connector = unwrap(
      await api.registerConnector({
        workspaceId: workspace.workspaceId,
        platform: "google",
        accountLabel: "api-smoke-google-account",
        surface: "browser_account",
        extractionStrategy: "browser",
        deleteCapability: "download_only"
      }),
      201
    );

    const snapshot = unwrap(
      await api.recordInventorySnapshot({
        connectorId: connector.connectorId,
        categories: [
          {
            category: "photos",
            itemCountEstimate: 1200,
            bytesEstimate: 60 * 1024 * 1024 * 1024,
            duplicateBytesEstimate: 10 * 1024 * 1024 * 1024,
            netNewBytesEstimate: 50 * 1024 * 1024 * 1024,
            importSupported: true,
            incrementalSupported: true,
            dateRangeStart: null,
            dateRangeEnd: null
          },
          {
            category: "mail",
            itemCountEstimate: 80000,
            bytesEstimate: 30 * 1024 * 1024 * 1024,
            duplicateBytesEstimate: 10 * 1024 * 1024 * 1024,
            netNewBytesEstimate: 20 * 1024 * 1024 * 1024,
            importSupported: true,
            incrementalSupported: true,
            dateRangeStart: null,
            dateRangeEnd: null
          }
        ],
        comparison: {
          sourceBytesEstimate: 90 * 1024 * 1024 * 1024,
          netNewBytesEstimate: 70 * 1024 * 1024 * 1024,
          existingAnchiseBytesEstimate: 10 * 1024 * 1024 * 1024,
          availableAnchiseBytes: 190 * 1024 * 1024 * 1024,
          fitState: "fits"
        }
      }),
      201
    );

    const plan = unwrap(
      await api.draftImportPlan({
        workspaceId: workspace.workspaceId,
        connectorId: connector.connectorId,
        snapshotId: snapshot.inventoryId,
        categories: ["photos", "mail"],
        sourceAction: "download_only"
      }),
      201
    );

    const confirmedPlan = unwrap(
      await api.confirmImportPlan({
        planId: plan.planId
      }),
      200
    );

    throw new RollbackPreview({
      rolledBack: true,
      schemaName,
      workspaceId: workspace.workspaceId,
      connectorId: connector.connectorId,
      snapshotId: snapshot.inventoryId,
      planId: plan.planId,
      confirmedStatus: confirmedPlan.status
    });
  });
} catch (error) {
  if (error instanceof RollbackPreview) {
    console.log(JSON.stringify(error.summary, null, 2));
    process.exit(0);
  }

  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
