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
  const [note, setNote] = useState("Create a workspace first. Inventory stays mandatory before import.");

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
        <div>
          <span className="eyebrow">Anchise control plane</span>
          <h1>Inventory first, then acquisition.</h1>
          <p>
            This is now a real Next.js surface mounted on the live control-plane routes. The user
            sees source size, net-new size, and storage fit in Anchise-controlled cloud space before
            any import is confirmed.
          </p>
        </div>
        <div className="hero-cards">
          <article className="stat-card">
            <span>Current fit</span>
            <strong>{snapshot?.comparison.fitState ?? "not computed"}</strong>
          </article>
          <article className="stat-card">
            <span>Net-new bytes</span>
            <strong>{formatBytes(snapshot?.comparison.netNewBytesEstimate)}</strong>
          </article>
          <article className="stat-card">
            <span>Plan status</span>
            <strong>{confirmedPlan?.status ?? draftPlan?.status ?? "not drafted"}</strong>
          </article>
        </div>
      </section>

      <section className="note-strip">
        <span>System note</span>
        <p>{note}</p>
      </section>

      <section className="grid">
        <article className="card">
          <header>
            <span className="badge">01</span>
            <div>
              <h2>Create Anchise space</h2>
              <p>Anchor everything in Anchise-controlled cloud storage from step 0.</p>
            </div>
          </header>

          <label>
            Owner ID
            <input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} />
          </label>
          <label>
            Storage tier (GB)
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
                setNote("Workspace created. Next, register the source lane.");
              })
            }
            disabled={isPending}
          >
            {workspace ? "Create a fresh workspace" : "Create workspace"}
          </button>

          {workspace ? (
            <div className="detail">
              <div>
                <span>Workspace</span>
                <strong>{workspace.workspaceId}</strong>
              </div>
              <div>
                <span>Capacity</span>
                <strong>{formatBytes(workspace.storageCapacityBytes)}</strong>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card">
          <header>
            <span className="badge">02</span>
            <div>
              <h2>Register source</h2>
              <p>Choose Google or local hardware before the inventory pass begins.</p>
            </div>
          </header>

          <div className="split">
            <label>
              Platform
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as Connector["platform"])}
              >
                <option value="google">Google</option>
                <option value="local_hardware">Local hardware</option>
              </select>
            </label>

            <label>
              Surface
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
            Account label
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
                Google export root
                <input
                  value={googleExportRootPath}
                  onChange={(event) => setGoogleExportRootPath(event.target.value)}
                />
              </label>
            </>
          ) : (
            <div className="split">
              <label>
                Local source root
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
                    ? "Source registered. Prepare the visible Google sign-in lane, then Anchise will wait for staged export files in the Google export root."
                    : "Source registered. Inventory can now sketch the digital footprint cheaply."
                );
              })
            }
          >
            Register source
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
                  className="secondary"
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
                  className="primary"
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
                  className="secondary"
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
                  className="secondary"
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

        <article className="card wide">
          <header>
            <span className="badge">03</span>
            <div>
              <h2>Review digital footprint</h2>
              <p>Save a lightweight inventory snapshot and expose space pressure before download.</p>
            </div>
          </header>

          <div className="split">
            <div className="detail">
              <div>
                <span>Inventory lane</span>
                <strong>{platform === "google" ? googleInventoryProfiles[presetKey].label : "Local filesystem"}</strong>
              </div>
              <div>
                <span>Step 0 rule</span>
                <strong>metadata first</strong>
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
                    `Inventory stored. ${result.data.discoveredItemCount} lightweight source items are visible before any download begins.`
                  );
                })
              }
            >
              Run inventory
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
                  <strong>{selectionSummary?.fitState ?? "unknown"}</strong>
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
                  <h3>This selected import is larger than the Anchise space available now.</h3>
                  <p>
                    Trim the selected categories or increase workspace space before any binary download starts.
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

        <article className="card wide">
          <header>
            <span className="badge">04</span>
            <div>
              <h2>Confirm incremental plan</h2>
              <p>Draft first, then confirm, so trust-sensitive acquisition starts only after review.</p>
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
              className="primary"
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
                  setNote("Draft ready. One more confirmation keeps the experience close to one click.");
                })
              }
            >
              Draft plan
            </button>

            <button
              className="secondary"
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
                   setNote("Confirmed. Anchise can now materialize a first incremental batch without downloading everything.");
                 })
               }
             >
              Confirm import
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
                <strong>{draftPlan.fitState}</strong>
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
              <span>Confirmed</span>
              <h3>The incremental plan is ready for execution.</h3>
              <p>
                Inventory happened first, the storage fit was visible, and duplicate-identical files
                can be skipped before the full download lane starts.
              </p>
            </div>
          ) : null}
        </article>

        <article className="card wide">
          <header>
            <span className="badge">05</span>
            <div>
              <h2>Materialize incremental batch</h2>
              <p>Only the next slice is prepared and committed, while duplicate content hashes skip a second binary copy.</p>
            </div>
          </header>

          <div className="split">
            <button
              className="primary"
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
                    `Batch ${result.data.batch.ordinal} is ready with ${result.data.sourceItems.length} deferred source items.`
                  );
                })
              }
            >
              Materialize next batch
            </button>

            <button
              className="secondary"
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
                    `Batch committed. ${result.data.storedObjectCount} new objects landed, ${result.data.dedupObjectCount} duplicates were skipped.`
                  );
                })
              }
            >
              Commit batch
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
    </main>
  );
}
