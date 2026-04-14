"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type {
  Category,
  CommittedImportBatch,
  Connector,
  GoogleConnectorAuthSession,
  GoogleConnectorArchiveImportResult,
  GoogleExportGuideAction,
  GoogleConnectorExportSession,
  InventoryRunResult,
  ImportPlan,
  InventorySnapshot,
  MaterializedImportBatch,
  Workspace
} from "@anchise/contracts";

import { createControlPlaneClient } from "../controlPlaneClient.js";

const controlPlaneClient = createControlPlaneClient();

const googleInventoryProfiles = {
  google_core: {
    label: "Google: photos + mail + geolocation",
    hint: "Balanced V1 inventory across the three main Google lanes."
  },
  space_warning: {
    label: "Google: over-capacity rehearsal",
    hint: "Useful when you want to verify that Anchise flags a selection before download."
  }
} as const;

const googleGuideStateLabels: Record<GoogleConnectorExportSession["guideState"], string> = {
  handoff_ready: "Handoff ready",
  categories_confirmed: "Categories confirmed",
  export_requested: "Export created",
  awaiting_archive: "Waiting for Google archive",
  files_detected: "Files detected",
  inventory_started: "Inventory started",
  inventory_completed: "Inventory completed"
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) {
    return "Unknown";
  }

  const gigabytes = bytes / 1024 / 1024 / 1024;
  return `${gigabytes.toFixed(gigabytes >= 100 ? 0 : 1)} GB`;
}

function formatTimestamp(timestamp: string | null | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : "not yet";
}

function formatFitLabel(fitState: string | null | undefined): string {
  switch (fitState) {
    case "fits":
      return "Fits now";
    case "likely_exceeds":
      return "Close to the limit";
    case "exceeds":
      return "Needs more space";
    default:
      return "Waiting for inventory";
  }
}

function calculateUsagePercent(
  amount: number | null | undefined,
  capacity: number | null | undefined
): number {
  if (!amount || !capacity || capacity <= 0) {
    return 0;
  }

  return Math.max(4, Math.min(100, Math.round((amount / capacity) * 100)));
}

function calculateFitState(
  netNewBytesEstimate: number,
  availableAnchiseBytes: number | null | undefined
): InventorySnapshot["comparison"]["fitState"] {
  if (availableAnchiseBytes === null || availableAnchiseBytes === undefined) {
    return "unknown";
  }

  if (netNewBytesEstimate <= availableAnchiseBytes) {
    return "fits";
  }

  return netNewBytesEstimate <= availableAnchiseBytes * 1.15 ? "likely_exceeds" : "exceeds";
}

function buildSelectionSummary(
  snapshot: InventorySnapshot | null,
  selectedCategories: Category[]
): {
  sourceBytesEstimate: number;
  netNewBytesEstimate: number;
  availableAnchiseBytes: number | null | undefined;
  fitState: InventorySnapshot["comparison"]["fitState"];
} | null {
  if (!snapshot) {
    return null;
  }

  const selectedSet = new Set(selectedCategories);
  const selectedEntries = snapshot.categories.filter((entry) => selectedSet.has(entry.category));
  const sourceBytesEstimate = selectedEntries.reduce(
    (total, entry) => total + (entry.bytesEstimate ?? 0),
    0
  );
  const netNewBytesEstimate = selectedEntries.reduce(
    (total, entry) => total + (entry.netNewBytesEstimate ?? 0),
    0
  );
  const availableAnchiseBytes = snapshot.comparison.availableAnchiseBytes;

  return {
    sourceBytesEstimate,
    netNewBytesEstimate,
    availableAnchiseBytes,
    fitState: calculateFitState(netNewBytesEstimate, availableAnchiseBytes)
  };
}

function pickCategoriesThatFit(snapshot: InventorySnapshot | null): Category[] {
  if (!snapshot) {
    return [];
  }

  const availableAnchiseBytes = snapshot.comparison.availableAnchiseBytes;

  if (availableAnchiseBytes === null || availableAnchiseBytes === undefined) {
    return snapshot.categories
      .filter((entry) => entry.importSupported)
      .map((entry) => entry.category);
  }

  const selected: Category[] = [];
  let runningTotal = 0;

  for (const entry of snapshot.categories.filter((category) => category.importSupported)) {
    const nextBytes = entry.netNewBytesEstimate ?? 0;

    if (runningTotal + nextBytes <= availableAnchiseBytes) {
      selected.push(entry.category);
      runningTotal += nextBytes;
    }
  }

  return selected;
}

export function JourneyShell() {
  const [isPending, startTransition] = useTransition();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [connector, setConnector] = useState<Connector | null>(null);
  const [inventoryRun, setInventoryRun] = useState<InventoryRunResult | null>(null);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [draftPlan, setDraftPlan] = useState<ImportPlan | null>(null);
  const [confirmedPlan, setConfirmedPlan] = useState<ImportPlan | null>(null);
  const [materializedBatch, setMaterializedBatch] = useState<MaterializedImportBatch | null>(null);
  const [committedBatch, setCommittedBatch] = useState<CommittedImportBatch | null>(null);
  const [note, setNote] = useState(
    "Start by creating the Anchise vault. Inventory stays mandatory before import."
  );

  const [ownerId, setOwnerId] = useState("emanuele-demo");
  const [storageCapacityGb, setStorageCapacityGb] = useState(200);
  const [platform, setPlatform] = useState<Connector["platform"]>("google");
  const [accountLabel, setAccountLabel] = useState("Google primary");
  const [surface, setSurface] = useState<Connector["surface"]>("browser_account");
  const [presetKey, setPresetKey] = useState<keyof typeof googleInventoryProfiles>("google_core");
  const [googleExportRootPath, setGoogleExportRootPath] = useState(
    "C:\\Users\\emanu\\Downloads\\Takeout"
  );
  const [localRootPath, setLocalRootPath] = useState("C:\\Users\\emanu\\Pictures");
  const [maxFiles, setMaxFiles] = useState(250);
  const [sourceAction, setSourceAction] = useState<ImportPlan["sourceAction"]>("download_only");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const googleArchiveInputRef = useRef<HTMLInputElement | null>(null);

  const selectionSummary = buildSelectionSummary(snapshot, selectedCategories);
  const recommendedCategories = pickCategoriesThatFit(snapshot);
  const activeGoogleSession: GoogleConnectorAuthSession | null =
    connector?.platform === "google" ? connector.authSession : null;
  const activeGoogleExportSession: GoogleConnectorExportSession | null =
    connector?.platform === "google" ? connector.exportSession : null;
  const needsGoogleAuth =
    connector?.platform === "google" && connector.authState !== "authenticated";
  const waitingForGoogleExportFiles =
    connector?.platform === "google" &&
    connector.authState === "authenticated" &&
    snapshot === null &&
    ["awaiting_files", "files_detected", "inventory_started"].includes(connector.exportState);
  const workspaceCapacityBytes =
    workspace?.storageCapacityBytes ?? storageCapacityGb * 1024 * 1024 * 1024;
  const visibleSourceBytes =
    selectionSummary?.sourceBytesEstimate ?? snapshot?.comparison.sourceBytesEstimate ?? null;
  const visibleNetNewBytes =
    selectionSummary?.netNewBytesEstimate ?? snapshot?.comparison.netNewBytesEstimate ?? null;
  const visibleAvailableBytes =
    selectionSummary?.availableAnchiseBytes ??
    snapshot?.comparison.availableAnchiseBytes ??
    workspace?.storageCapacityBytes ??
    null;
  const visibleFitState =
    selectionSummary?.fitState ?? draftPlan?.fitState ?? snapshot?.comparison.fitState ?? "unknown";
  const vaultUsagePercent = calculateUsagePercent(visibleNetNewBytes, workspaceCapacityBytes);
  const nextSectionId = !workspace
    ? "step-space"
    : !connector
      ? "step-source"
      : !snapshot
        ? "step-footprint"
        : !confirmedPlan
          ? "step-plan"
          : "step-batch";
  const heroActionLabel = !workspace
    ? "Start with Anchise space"
    : !connector
      ? "Choose the first source"
      : needsGoogleAuth
        ? "Complete Google handoff"
        : waitingForGoogleExportFiles
          ? "Watch for the archive"
          : !snapshot
            ? "Review the footprint"
            : !confirmedPlan
              ? "Approve the import plan"
              : !committedBatch
                ? "Bring in the first slice"
                : "Review the next slice";

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function chooseCategory(category: Category, checked: boolean) {
    setSelectedCategories((current) =>
      checked ? [...new Set([...current, category])] : current.filter((entry) => entry !== category)
    );
  }

  function runTask(task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch {
        setNote("Unexpected client error while talking to the control plane.");
      }
    });
  }

  function advanceGoogleExportGuide(action: GoogleExportGuideAction, successNote: string) {
    runTask(async () => {
      if (!connector) {
        return;
      }

      const result = await controlPlaneClient.advanceGoogleConnectorExport({
        connectorId: connector.connectorId,
        action
      });

      if (!result.ok) {
        setNote(result.error.message);
        return;
      }

      setConnector(result.data.connector);
      setNote(successNote);
    });
  }

  function applyGoogleArchiveImportResult(result: GoogleConnectorArchiveImportResult) {
    setConnector(result.connector);

    if (result.inventoryRun) {
      setInventoryRun(result.inventoryRun);
      setSnapshot(result.inventoryRun.snapshot);
      setDraftPlan(null);
      setConfirmedPlan(null);
      setMaterializedBatch(null);
      setCommittedBatch(null);
      setSelectedCategories(
        result.inventoryRun.snapshot.categories
          .filter((entry) => entry.importSupported)
          .map((entry) => entry.category)
      );
      setNote(
        `Imported ${result.uploadedFileName} into ${result.session.exportRootPath}. Anchise extracted it locally and inventory found ${result.inventoryRun.discoveredItemCount} source items.`
      );
      return;
    }

    setNote(
      `Imported ${result.uploadedFileName} into ${result.session.exportRootPath}. Anchise is checking the extracted files now.`
    );
  }

  function uploadGoogleArchive(file: File) {
    runTask(async () => {
      if (!connector) {
        return;
      }

      const formData = new FormData();
      formData.append("connectorId", connector.connectorId);
      formData.append("archive", file, file.name);

      const response = await fetch("/api/control-plane/connectors/google/import-archive", {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as import("@anchise/contracts").UploadGoogleConnectorArchiveResponse;

      if (!result.ok) {
        setNote(result.error.message);
        return;
      }

      applyGoogleArchiveImportResult(result.data);
    });
  }

  useEffect(() => {
    if (
      !connector ||
      connector.platform !== "google" ||
      !activeGoogleExportSession ||
      !waitingForGoogleExportFiles
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      const result = await controlPlaneClient.checkGoogleConnectorExport({
        connectorId: connector.connectorId
      });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setNote(result.error.message);
        return;
      }

      setConnector(result.data.connector);

      if (result.data.inventoryRun) {
        setInventoryRun(result.data.inventoryRun);
        setSnapshot(result.data.inventoryRun.snapshot);
        setDraftPlan(null);
        setConfirmedPlan(null);
        setMaterializedBatch(null);
        setCommittedBatch(null);
        setSelectedCategories(
          result.data.inventoryRun.snapshot.categories
            .filter((entry) => entry.importSupported)
            .map((entry) => entry.category)
        );
        setNote(
          `Export files detected in ${result.data.session.exportRootPath}. Anchise started inventory automatically and found ${result.data.inventoryRun.discoveredItemCount} source items.`
        );
        return;
      }

      setNote(
        `Waiting for export files in ${result.data.session.exportRootPath}. Anchise will start inventory automatically when files appear.`
      );
      timeoutId = window.setTimeout(poll, 4000);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    connector?.connectorId,
    connector?.platform,
    connector?.authState,
    connector?.exportState,
    activeGoogleExportSession?.sessionId,
    waitingForGoogleExportFiles,
    snapshot?.inventoryId
  ]);

  return (
    <main className="canvas">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Anchise V1</span>
          <h1>See the shape of a digital life before any import begins.</h1>
          <p>
            Anchise keeps the experience one-click simple on the surface while staying
            metadata-first, space-aware, deduplicated, and incremental underneath.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary hero-primary"
              onClick={() => scrollToSection(nextSectionId)}
            >
              {heroActionLabel}
            </button>
            <p className="hero-caption">
              Inventory comes first. Full download waits until the user has seen what fits.
            </p>
          </div>
        </div>
        <div className="hero-cards">
          <article className="stat-card">
            <span>Anchise vault</span>
            <strong>{formatBytes(workspaceCapacityBytes)}</strong>
          </article>
          <article className="stat-card">
            <span>Visible source</span>
            <strong>{formatBytes(visibleSourceBytes)}</strong>
          </article>
          <article className="stat-card">
            <span>Net-new if approved</span>
            <strong>{formatBytes(visibleNetNewBytes)}</strong>
          </article>
          <article className="stat-card">
            <span>Current fit</span>
            <strong>{formatFitLabel(visibleFitState)}</strong>
          </article>
        </div>
      </section>

      <section className="note-strip">
        <span>What happens now</span>
        <p>{note}</p>
      </section>

      <div className="journey-main">
        <section className="grid stage-stack">
          <article id="step-space" className="card">
          <header>
            <span className="badge">01</span>
            <div>
              <h2>Create the Anchise vault</h2>
              <p>Reserve the cloud space first so the user can see what fits before anything lands.</p>
            </div>
          </header>

          <label>
            Vault owner label
            <input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} />
          </label>
          <label>
            Reserved space (GB)
            <input
              type="number"
              min={50}
              step={10}
              value={storageCapacityGb}
              onChange={(event) => setStorageCapacityGb(Number(event.target.value))}
            />
          </label>

          <button
            className="primary"
            onClick={() =>
              runTask(async () => {
                const result = await controlPlaneClient.createWorkspace({
                  ownerId,
                  storageCapacityBytes: storageCapacityGb * 1024 * 1024 * 1024,
                  planState: "trial",
                  agentState: "paired"
                });

                if (!result.ok) {
                  setNote(result.error.message);
                  return;
                }

                setWorkspace(result.data);
                setConnector(null);
                setInventoryRun(null);
                setSnapshot(null);
                setDraftPlan(null);
                setConfirmedPlan(null);
                setMaterializedBatch(null);
                setCommittedBatch(null);
                setSelectedCategories([]);
                  setNote("Anchise vault ready. Next, choose the first footprint lane.");
                })
            }
            disabled={isPending}
          >
            {workspace ? "Create a fresh Anchise vault" : "Create Anchise vault"}
          </button>

          {workspace ? (
            <div className="detail">
              <div>
                <span>Vault reference</span>
                <strong>{workspace.workspaceId}</strong>
              </div>
              <div>
                <span>Reserved capacity</span>
                <strong>{formatBytes(workspace.storageCapacityBytes)}</strong>
              </div>
            </div>
          ) : null}
        </article>

        <article id="step-source" className="card">
          <header>
            <span className="badge">02</span>
            <div>
              <h2>Choose the first source lane</h2>
              <p>Make the footprint visible before import by connecting Google or a local folder.</p>
            </div>
          </header>

          <div className="split">
            <label>
              Source type
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as Connector["platform"])}
              >
                <option value="google">Google</option>
                <option value="local_hardware">Local hardware</option>
              </select>
            </label>

            <label>
              Collection surface
              <select
                value={surface}
                onChange={(event) => setSurface(event.target.value as Connector["surface"])}
              >
                <option value="browser_account">Browser account</option>
                <option value="local_folder">Local folder</option>
              </select>
            </label>
          </div>

          <label>
            Source label
            <input value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} />
          </label>

          {platform === "google" ? (
            <>
              <label>
                Inventory profile
                <select
                  value={presetKey}
                  onChange={(event) =>
                    setPresetKey(event.target.value as keyof typeof googleInventoryProfiles)
                  }
                >
                  {Object.entries(googleInventoryProfiles).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Google watch folder
                <input
                  value={googleExportRootPath}
                  onChange={(event) => setGoogleExportRootPath(event.target.value)}
                />
              </label>
            </>
          ) : (
            <div className="split">
              <label>
                Local source folder
                <input
                  value={localRootPath}
                  onChange={(event) => setLocalRootPath(event.target.value)}
                />
              </label>
              <label>
                Max files
                <input
                  type="number"
                  min={25}
                  step={25}
                  value={maxFiles}
                  onChange={(event) => setMaxFiles(Number(event.target.value))}
                />
              </label>
            </div>
          )}

          <button
            className="primary"
            disabled={!workspace || isPending}
            onClick={() =>
              runTask(async () => {
                if (!workspace) {
                  setNote("Create the workspace first.");
                  return;
                }

                if (platform === "google" && googleExportRootPath.trim() === "") {
                  setNote("Set the Google export root so Anchise knows where to inventory the staged files.");
                  return;
                }

                const result = await controlPlaneClient.registerConnector({
                  workspaceId: workspace.workspaceId,
                  platform,
                  accountLabel,
                  surface,
                  extractionStrategy: surface === "local_folder" ? "local" : "browser",
                  deleteCapability: "download_only",
                  settings:
                    platform === "google"
                      ? {
                          inventoryProfile: presetKey,
                          rootPath: googleExportRootPath
                        }
                      : {
                          rootPath: localRootPath,
                          maxFiles
                        }
                });

                if (!result.ok) {
                  setNote(result.error.message);
                  return;
                }

                setConnector(result.data);
                setInventoryRun(null);
                setSnapshot(null);
                setDraftPlan(null);
                setConfirmedPlan(null);
                setMaterializedBatch(null);
                setCommittedBatch(null);
                setSelectedCategories([]);
                  setNote(
                    result.data.platform === "google"
                      ? "Source connected. Finish the visible Google handoff and Anchise will wait for the staged archive."
                      : "Source connected. Anchise can now sketch the digital footprint cheaply."
                  );
                })
            }
          >
            Connect this source
          </button>

          {connector ? (
            <div className="detail">
              <div>
                <span>Connector state</span>
                <strong>{connector.state}</strong>
              </div>
              <div>
                <span>Execution surface</span>
                <strong>{connector.surface}</strong>
              </div>
              <div>
                <span>Auth state</span>
                <strong>{connector.authState}</strong>
              </div>
            </div>
          ) : null}

          {connector?.platform === "google" ? (
            <>
              <div className="detail">
                <div>
                  <span>Google lane</span>
                  <strong>manual visible browser</strong>
                </div>
                <div>
                  <span>Requested lane</span>
                  <strong>{googleInventoryProfiles[presetKey].hint}</strong>
                </div>
                <div>
                  <span>Export root</span>
                  <strong>{connector.settings.rootPath ?? "not set"}</strong>
                </div>
                <div>
                  <span>Session</span>
                  <strong>{activeGoogleSession?.status ?? "not prepared"}</strong>
                </div>
                <div>
                  <span>Export session</span>
                  <strong>{activeGoogleExportSession?.status ?? connector.exportState}</strong>
                </div>
              </div>

              <div className="split">
                <button
                  className={!activeGoogleSession ? "primary" : "secondary"}
                  disabled={!connector || isPending}
                  onClick={() =>
                    runTask(async () => {
                      if (!connector) {
                        return;
                      }

                      const result = await controlPlaneClient.prepareGoogleConnectorAuth({
                        connectorId: connector.connectorId
                      });

                      if (!result.ok) {
                        setNote(result.error.message);
                        return;
                      }

                      setConnector(result.data.connector);
                      setNote(
                        "Google sign-in lane prepared. Open the visible login window, finish sign-in, then confirm here."
                      );
                    })
                  }
                >
                  Prepare Google sign-in
                </button>

                <button
                  className="secondary"
                  disabled={!activeGoogleSession}
                  onClick={() => {
                    if (!activeGoogleSession) {
                      return;
                    }

                    window.open(activeGoogleSession.launchUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open Google sign-in
                </button>

                <button
                  className={
                    activeGoogleSession && connector?.authState !== "authenticated"
                      ? "primary"
                      : "secondary"
                  }
                  disabled={!connector || !activeGoogleSession || isPending}
                  onClick={() =>
                    runTask(async () => {
                      if (!connector || !activeGoogleSession) {
                        return;
                      }

                      const result = await controlPlaneClient.completeGoogleConnectorAuth({
                        connectorId: connector.connectorId,
                        sessionId: activeGoogleSession.sessionId
                      });

                      if (!result.ok) {
                        setNote(result.error.message);
                        return;
                      }

                      setConnector(result.data.connector);
                      const preparedExportRoot =
                        result.data.connector.exportSession?.exportRootPath ??
                        result.data.connector.settings.rootPath ??
                        "the configured watch folder";
                      setNote(
                        `Google sign-in marked complete. Anchise prepared ${preparedExportRoot} as the watch folder and will trigger inventory automatically when export files land there.`
                      );
                    })
                  }
                >
                  I completed sign-in
                </button>

                <input
                  ref={googleArchiveInputRef}
                  hidden
                  accept=".zip,.tgz,.tar.gz,.tar,application/zip,application/gzip,application/x-tar"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";

                    if (!file) {
                      return;
                    }

                    uploadGoogleArchive(file);
                  }}
                />

                <button
                  className={
                    connector?.authState === "authenticated" &&
                    !waitingForGoogleExportFiles &&
                    !snapshot
                      ? "primary"
                      : "secondary"
                  }
                  disabled={!activeGoogleExportSession?.handoffUrl}
                  onClick={() => {
                    if (!activeGoogleExportSession?.handoffUrl) {
                      return;
                    }

                    window.open(activeGoogleExportSession.handoffUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open Google export
                </button>

                <button
                  className="secondary"
                  disabled={!connector || isPending}
                  onClick={() => {
                    googleArchiveInputRef.current?.click();
                  }}
                >
                  Import archive here
                </button>

                <button
                  className={waitingForGoogleExportFiles ? "primary" : "secondary"}
                  disabled={!connector || isPending}
                  onClick={() =>
                    runTask(async () => {
                      if (!connector) {
                        return;
                      }

                      const result = await controlPlaneClient.openGoogleConnectorExportRoot({
                        connectorId: connector.connectorId
                      });

                      if (!result.ok) {
                        setNote(result.error.message);
                        return;
                      }

                      setConnector(result.data.connector);
                      setNote(`Opened watch folder: ${result.data.openedPath}`);
                    })
                  }
                >
                  Open watch folder
                </button>

                <button
                  className="secondary"
                  disabled={!activeGoogleExportSession?.exportRootPath}
                  onClick={() => {
                    if (!activeGoogleExportSession?.exportRootPath) {
                      return;
                    }

                    void navigator.clipboard.writeText(activeGoogleExportSession.exportRootPath);
                    setNote(
                      `Watch folder copied: ${activeGoogleExportSession.exportRootPath}`
                    );
                  }}
                >
                  Copy watch folder
                </button>
              </div>

              {activeGoogleSession ? (
                <div className="detail">
                  <div>
                    <span>Prepared</span>
                    <strong>{new Date(activeGoogleSession.preparedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Requested categories</span>
                    <strong>{activeGoogleSession.requestedCategories.join(", ")}</strong>
                  </div>
                  <div>
                    <span>Export root watch</span>
                    <strong>{activeGoogleExportSession?.exportRootPath ?? connector.settings.rootPath ?? "not set"}</strong>
                  </div>
                </div>
              ) : null}

              {activeGoogleExportSession ? (
                <div className="detail">
                  <div>
                    <span>Waiting since</span>
                    <strong>{new Date(activeGoogleExportSession.waitingStartedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Folder ready</span>
                    <strong>
                      {formatTimestamp(activeGoogleExportSession.watchFolderReadyAt)}
                    </strong>
                  </div>
                  <div>
                    <span>Last check</span>
                    <strong>
                      {activeGoogleExportSession.lastCheckedAt
                        ? new Date(activeGoogleExportSession.lastCheckedAt).toLocaleString()
                        : "not yet checked"}
                    </strong>
                  </div>
                  <div>
                    <span>Detected files</span>
                    <strong>{activeGoogleExportSession.detectedItemCount ?? 0}</strong>
                  </div>
                </div>
              ) : null}

              {activeGoogleExportSession ? (
                <div className="confirm-box">
                  <span>Visible lane guide</span>
                  <h3>Google export handoff</h3>
                  <p>
                    Expected artifact:{" "}
                    {activeGoogleExportSession.archiveExpectation ?? "Google export archive"}.
                  </p>
                  <div className="detail">
                    <div>
                      <span>Guide status</span>
                      <strong>{googleGuideStateLabels[activeGoogleExportSession.guideState]}</strong>
                    </div>
                    <div>
                      <span>Categories verified</span>
                      <strong>{formatTimestamp(activeGoogleExportSession.categoriesConfirmedAt)}</strong>
                    </div>
                    <div>
                      <span>Export created</span>
                      <strong>{formatTimestamp(activeGoogleExportSession.exportRequestedAt)}</strong>
                    </div>
                    <div>
                      <span>Waiting for archive</span>
                      <strong>{formatTimestamp(activeGoogleExportSession.awaitingArchiveAt)}</strong>
                    </div>
                  </div>
                  <div className="split">
                    <button
                      className="secondary"
                      disabled={isPending}
                      onClick={() =>
                        advanceGoogleExportGuide(
                          "confirm_categories",
                          "Google categories confirmed in the visible lane. Anchise is still metadata-first and waiting for the archive handoff."
                        )
                      }
                    >
                      I verified categories
                    </button>
                    <button
                      className="secondary"
                      disabled={isPending}
                      onClick={() =>
                        advanceGoogleExportGuide(
                          "mark_export_created",
                          "Google export creation is marked. Anchise will keep the watch folder ready for the incoming archive."
                        )
                      }
                    >
                      I created the export
                    </button>
                    <button
                      className="secondary"
                      disabled={isPending}
                      onClick={() =>
                        advanceGoogleExportGuide(
                          "mark_waiting_for_archive",
                          "Anchise marked this connector as waiting for Google's archive. The watch folder stays armed for automatic inventory."
                        )
                      }
                    >
                      Waiting for archive
                    </button>
                    <button
                      className="secondary"
                      disabled={!connector || isPending}
                      onClick={() =>
                        runTask(async () => {
                          if (!connector) {
                            return;
                          }

                          const result = await controlPlaneClient.checkGoogleConnectorExport({
                            connectorId: connector.connectorId
                          });

                          if (!result.ok) {
                            setNote(result.error.message);
                            return;
                          }

                          setConnector(result.data.connector);
                          if (result.data.inventoryRun) {
                            setInventoryRun(result.data.inventoryRun);
                            setSnapshot(result.data.inventoryRun.snapshot);
                            setDraftPlan(null);
                            setConfirmedPlan(null);
                            setMaterializedBatch(null);
                            setCommittedBatch(null);
                            setSelectedCategories(
                              result.data.inventoryRun.snapshot.categories
                                .filter((entry) => entry.importSupported)
                                .map((entry) => entry.category)
                            );
                            setNote(
                              `Export files detected in ${result.data.session.exportRootPath}. Anchise started inventory automatically and found ${result.data.inventoryRun.discoveredItemCount} source items.`
                            );
                            return;
                          }

                          setNote(
                            `Still waiting for export files in ${result.data.session.exportRootPath}. Anchise will auto-start inventory as soon as the archive lands there.`
                          );
                        })
                      }
                    >
                      Check watch folder now
                    </button>
                  </div>
                  <div className="category-list">
                    {activeGoogleExportSession.orchestrationSteps.map((step, index) => (
                      <div key={`${activeGoogleExportSession.sessionId}-${index}`} className="category-row">
                        <div>
                          <strong>{`Step ${index + 1}`}</strong>
                          <span>{step}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </article>

        <article id="step-footprint" className="card wide">
          <header>
            <span className="badge">03</span>
            <div>
              <h2>Review the footprint before import</h2>
              <p>Collect lightweight metadata first so the user can see size, fit, and pressure before download.</p>
            </div>
          </header>

          <div className="split">
              <div className="detail">
                <div>
                  <span>Footprint lane</span>
                  <strong>{platform === "google" ? googleInventoryProfiles[presetKey].label : "Local filesystem"}</strong>
                </div>
                <div>
                  <span>Locked rule</span>
                  <strong>metadata before download</strong>
                </div>
              </div>

            <button
              className="primary align-end"
              disabled={!connector || needsGoogleAuth || waitingForGoogleExportFiles || isPending}
              onClick={() =>
                runTask(async () => {
                  if (!connector) {
                    setNote("Register a connector first.");
                    return;
                  }

                  const result = await controlPlaneClient.runConnectorInventory({
                    connectorId: connector.connectorId
                  });

                  if (!result.ok) {
                    setNote(result.error.message);
                    return;
                  }

                  setInventoryRun(result.data);
                  setSnapshot(result.data.snapshot);
                  setDraftPlan(null);
                  setConfirmedPlan(null);
                  setMaterializedBatch(null);
                  setCommittedBatch(null);
                  setSelectedCategories(
                    result.data.snapshot.categories
                      .filter(
                        (entry: InventorySnapshot["categories"][number]) => entry.importSupported
                      )
                      .map((entry: InventorySnapshot["categories"][number]) => entry.category)
                  );
                    setNote(
                      `Footprint mapped. ${result.data.discoveredItemCount} lightweight source items are now visible before any download begins.`
                    );
                  })
              }
            >
              Scan the footprint
            </button>
          </div>

          {needsGoogleAuth ? (
            <div className="confirm-box">
              <span>Connect first</span>
              <h3>Google inventory stays locked until the visible sign-in lane is completed.</h3>
              <p>
                This keeps credentials user-controlled and makes the inventory step explicit before
                Anchise scans the staged Google export metadata.
              </p>
            </div>
          ) : null}

          {waitingForGoogleExportFiles && activeGoogleExportSession ? (
            <div className="confirm-box">
              <span>Waiting for files</span>
              <h3>Anchise is watching the staged Google export root and will auto-start inventory.</h3>
              <p>
                Export root: {activeGoogleExportSession.exportRootPath}. Save or extract the Google
                export into this watch folder. Last check:{" "}
                {activeGoogleExportSession.lastCheckedAt
                  ? new Date(activeGoogleExportSession.lastCheckedAt).toLocaleString()
                  : "not yet checked"}.
              </p>
            </div>
          ) : null}

          {snapshot ? (
            <>
              {inventoryRun ? (
                <div className="detail">
                  <div>
                    <span>Adapter</span>
                    <strong>{inventoryRun.strategyLabel}</strong>
                  </div>
                  <div>
                    <span>Discovered items</span>
                    <strong>{inventoryRun.discoveredItemCount.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Deferred items</span>
                    <strong>{inventoryRun.deferredItemCount.toLocaleString()}</strong>
                  </div>
                </div>
              ) : null}

              <div className="metrics">
                <article className="metric-card">
                  <span>Source size</span>
                  <strong>{formatBytes(snapshot.comparison.sourceBytesEstimate)}</strong>
                </article>
                <article className="metric-card">
                  <span>Net-new size</span>
                  <strong>{formatBytes(snapshot.comparison.netNewBytesEstimate)}</strong>
                </article>
                <article className="metric-card">
                  <span>Available space</span>
                  <strong>{formatBytes(snapshot.comparison.availableAnchiseBytes)}</strong>
                </article>
              </div>

              <div className="detail">
                <div>
                  <span>Selected source size</span>
                  <strong>{formatBytes(selectionSummary?.sourceBytesEstimate)}</strong>
                </div>
                <div>
                  <span>Selected net-new</span>
                  <strong>{formatBytes(selectionSummary?.netNewBytesEstimate)}</strong>
                </div>
                <div>
                  <span>Selected fit</span>
                  <strong>{formatFitLabel(selectionSummary?.fitState)}</strong>
                </div>
              </div>

              <div className="split">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setSelectedCategories(
                      snapshot.categories
                        .filter((entry) => entry.importSupported)
                        .map((entry) => entry.category)
                    )
                  }
                >
                  Select all importable
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedCategories(recommendedCategories)}
                >
                  Select what fits
                </button>
              </div>

              {selectionSummary && selectionSummary.fitState === "exceeds" ? (
                <div className="confirm-box">
                  <span>Space check</span>
                  <h3>This selection is larger than the Anchise vault can hold right now.</h3>
                  <p>
                    Trim the selected categories or increase reserved space before any binary download starts.
                  </p>
                </div>
              ) : null}

              <div className="category-list">
                {snapshot.categories.map((entry) => (
                  <label key={entry.category} className="category-row">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(entry.category)}
                      disabled={!entry.importSupported}
                      onChange={(event) => chooseCategory(entry.category, event.target.checked)}
                    />
                    <div>
                      <strong>{entry.category}</strong>
                      <span>
                        {entry.itemCountEstimate?.toLocaleString() ?? "Unknown"} items |
                        {formatBytes(entry.netNewBytesEstimate)}
                      </span>
                    </div>
                    <em>{entry.incrementalSupported ? "incremental" : "full refresh only"}</em>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </article>

        <article id="step-plan" className="card wide">
          <header>
            <span className="badge">04</span>
            <div>
              <h2>Approve the incremental plan</h2>
              <p>Draft first, then approve, so Anchise starts acquisition only after the user has seen the shape.</p>
            </div>
          </header>

          <div className="split">
            <button
              type="button"
              className={sourceAction === "download_only" ? "choice selected" : "choice"}
              onClick={() => setSourceAction("download_only")}
            >
              <strong>Download only</strong>
              <span>Safest V1 lane.</span>
            </button>
            <button
              type="button"
              className={
                sourceAction === "download_and_delete_source" ? "choice selected" : "choice"
              }
              onClick={() => setSourceAction("download_and_delete_source")}
            >
              <strong>Download and request delete</strong>
              <span>Modeled, but still gated downstream.</span>
            </button>
          </div>

          <div className="split">
              <button
                className={!draftPlan ? "primary" : "secondary"}
                disabled={!snapshot || selectedCategories.length === 0 || isPending}
                onClick={() =>
                runTask(async () => {
                  if (!workspace || !connector || !snapshot) {
                    setNote("Workspace, connector, and inventory must exist first.");
                    return;
                  }

                  const result = await controlPlaneClient.draftImportPlan({
                    workspaceId: workspace.workspaceId,
                    connectorId: connector.connectorId,
                    snapshotId: snapshot.inventoryId,
                    categories: selectedCategories,
                    sourceAction
                  });

                  if (!result.ok) {
                    setNote(result.error.message);
                    return;
                  }

                  setDraftPlan(result.data);
                  setConfirmedPlan(null);
                  setNote("Draft ready. One approval now keeps the flow simple while preserving trust.");
                })
              }
            >
              Draft the plan
            </button>

              <button
                className={
                  draftPlan && draftPlan.fitState !== "exceeds" ? "primary" : "secondary"
                }
                disabled={!draftPlan || draftPlan.fitState === "exceeds" || isPending}
                onClick={() =>
                runTask(async () => {
                  if (!draftPlan) {
                    return;
                  }

                  const result = await controlPlaneClient.confirmImportPlan({
                    planId: draftPlan.planId
                  });

                  if (!result.ok) {
                    setNote(result.error.message);
                    return;
                  }

                   setConfirmedPlan(result.data);
                   setMaterializedBatch(null);
                   setCommittedBatch(null);
                    setNote("Plan approved. Anchise can now prepare the first incremental slice without downloading everything.");
                  })
                }
              >
               Approve import
             </button>
          </div>

          {draftPlan ? (
            <div className="detail">
              <div>
                <span>Draft state</span>
                <strong>{draftPlan.status}</strong>
              </div>
              <div>
                <span>Selected categories</span>
                <strong>{draftPlan.categories.join(", ")}</strong>
              </div>
              <div>
                <span>Fit state</span>
                <strong>{formatFitLabel(draftPlan.fitState)}</strong>
              </div>
              <div>
                <span>Selected net-new</span>
                <strong>{formatBytes(draftPlan.netNewBytesEstimate)}</strong>
              </div>
              <div>
                <span>Available space</span>
                <strong>{formatBytes(draftPlan.availableAnchiseBytes)}</strong>
              </div>
            </div>
          ) : null}

          {confirmedPlan ? (
            <div className="confirm-box">
              <span>Approved</span>
              <h3>The incremental plan is ready for execution.</h3>
              <p>
                Inventory happened first, the storage fit was visible, and duplicate-identical files
                can be skipped before the full download lane starts.
              </p>
            </div>
          ) : null}
        </article>

        <article id="step-batch" className="card wide">
          <header>
            <span className="badge">05</span>
            <div>
              <h2>Bring in only the next slice</h2>
              <p>Prepare and commit the next incremental batch while duplicate-identical content stays single-copy.</p>
            </div>
          </header>

          <div className="split">
              <button
                className={!materializedBatch ? "primary" : "secondary"}
                disabled={!confirmedPlan || isPending}
                onClick={() =>
                runTask(async () => {
                  if (!confirmedPlan) {
                    setNote("Confirm the plan before materializing a batch.");
                    return;
                  }

                  const result = await controlPlaneClient.materializeImportBatch({
                    planId: confirmedPlan.planId,
                    batchSize: 4
                  });

                  if (!result.ok) {
                    setNote(result.error.message);
                    return;
                  }

                  setMaterializedBatch(result.data);
                  setCommittedBatch(null);
                  setNote(
                    `Slice ${result.data.batch.ordinal} is ready with ${result.data.sourceItems.length} deferred source items.`
                  );
                })
              }
            >
              Prepare next slice
            </button>

              <button
                className={materializedBatch ? "primary" : "secondary"}
                disabled={!materializedBatch || isPending}
                onClick={() =>
                runTask(async () => {
                  if (!materializedBatch) {
                    return;
                  }

                  const result = await controlPlaneClient.commitImportBatch({
                    batchId: materializedBatch.batch.batchId,
                    objects: materializedBatch.sourceItems.map((item) => ({
                      sourceItemId: item.sourceItemId,
                      contentHash: item.contentHashHint ?? `hash-${item.sourceItemId}`,
                      byteSize: item.byteSizeEstimate ?? 1,
                      storedByteSize: item.byteSizeEstimate ?? 1,
                      mimeType: item.mimeType ?? "application/octet-stream",
                      title: item.title ?? item.externalItemId,
                      originalAt: item.externalUpdatedAt,
                      hasLocation: item.category === "geolocation",
                      sourceMetadata: item.metadata
                    }))
                  });

                  if (!result.ok) {
                    setNote(result.error.message);
                    return;
                  }

                  setCommittedBatch(result.data);
                  setNote(
                    `Slice committed. ${result.data.storedObjectCount} new objects landed and ${result.data.dedupObjectCount} duplicate matches were skipped.`
                  );
                })
              }
            >
              Commit slice
            </button>
          </div>

          {materializedBatch ? (
            <div className="detail">
              <div>
                <span>Batch</span>
                <strong>#{materializedBatch.batch.ordinal}</strong>
              </div>
              <div>
                <span>Items planned</span>
                <strong>{materializedBatch.batch.itemsExpected}</strong>
              </div>
              <div>
                <span>Bytes planned</span>
                <strong>{formatBytes(materializedBatch.batch.bytesPlanned)}</strong>
              </div>
            </div>
          ) : null}

          {committedBatch ? (
            <div className="confirm-box">
              <span>Committed</span>
              <h3>The first incremental slice is wired into the Anchise manifest lane.</h3>
              <p>
                New objects raise Anchise storage usage only when their content hash is new. Duplicate
                matches keep provenance without storing a second identical file.
              </p>
            </div>
          ) : null}
        </article>
        </section>

        <aside className="rail">
          <article className="rail-card">
            <span className="rail-label">Anchise vault</span>
            <h3>{workspace ? "Cloud space is reserved" : "Reserve the vault first"}</h3>
            <p>
              The user sees available space before Anchise starts any real acquisition, and identical
              files stay single-copy by content hash.
            </p>
            <div className="vault-meter" aria-hidden="true">
              <span style={{ width: `${vaultUsagePercent}%` }} />
            </div>
            <div className="rail-stats">
              <div>
                <span>Reserved</span>
                <strong>{formatBytes(workspaceCapacityBytes)}</strong>
              </div>
              <div>
                <span>Visible net-new</span>
                <strong>{formatBytes(visibleNetNewBytes)}</strong>
              </div>
              <div>
                <span>Available now</span>
                <strong>{formatBytes(visibleAvailableBytes)}</strong>
              </div>
              <div>
                <span>Fit state</span>
                <strong>{formatFitLabel(visibleFitState)}</strong>
              </div>
            </div>
          </article>

          <article className="rail-card">
            <span className="rail-label">Journey</span>
            <div className="rail-steps">
              {[
                {
                  id: "step-space",
                  number: "01",
                  title: "Create vault",
                  state: workspace ? "ready" : "next"
                },
                {
                  id: "step-source",
                  number: "02",
                  title: "Connect source",
                  state: connector ? "ready" : workspace ? "next" : "locked"
                },
                {
                  id: "step-footprint",
                  number: "03",
                  title: "Review footprint",
                  state: snapshot ? "ready" : connector ? "next" : "locked"
                },
                {
                  id: "step-plan",
                  number: "04",
                  title: "Approve plan",
                  state: confirmedPlan ? "ready" : snapshot ? "next" : "locked"
                },
                {
                  id: "step-batch",
                  number: "05",
                  title: "Commit slice",
                  state: committedBatch ? "ready" : confirmedPlan ? "next" : "locked"
                }
              ].map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={`rail-step rail-step-${step.state}`}
                  onClick={() => scrollToSection(step.id)}
                >
                  <span>{step.number}</span>
                  <strong>{step.title}</strong>
                </button>
              ))}
            </div>
          </article>

          <article className="rail-card">
            <span className="rail-label">Locked principles</span>
            <div className="policy-list">
              <div className="policy-item">
                <strong>Inventory first</strong>
                <p>The user sees metadata and fit before download begins.</p>
              </div>
              <div className="policy-item">
                <strong>Incremental by default</strong>
                <p>Anchise prepares only the next slice instead of pulling everything at once.</p>
              </div>
              <div className="policy-item">
                <strong>Single-copy storage</strong>
                <p>Duplicate-identical binaries keep provenance without a second stored file.</p>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
}
