import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";

import { createGoogleBrowserLanePlan, createGoogleExportHandoffPlan } from "@anchise/agent";
import type {
  AdvanceGoogleConnectorExportInput,
  Category,
  CheckGoogleConnectorExportInput,
  CommitImportBatchInput,
  CommittedImportBatch,
  CompleteGoogleConnectorAuthInput,
  Connector,
  GoogleConnectorArchiveImportResult,
  GoogleConnectorAuthResult,
  GoogleConnectorExportCheckResult,
  GoogleConnectorExportProgressResult,
  GoogleConnectorExportRootOpenResult,
  GoogleExportGuideAction,
  GoogleExportGuideState,
  GoogleConnectorExportSession,
  InventoryRunResult,
  MaterializeImportBatchInput,
  MaterializedImportBatch,
  PrepareGoogleConnectorAuthInput
} from "@anchise/contracts";

import {
  ControlPlaneInputError,
  createControlPlaneRepository,
  type ControlPlaneRepository
} from "./controlPlaneRepository.js";
import { getInventoryAdapter, probeGoogleExportStaging } from "./inventoryAdapters.js";

export interface ControlPlaneRuntime {
  prepareGoogleConnectorAuth(input: PrepareGoogleConnectorAuthInput): Promise<GoogleConnectorAuthResult>;
  completeGoogleConnectorAuth(input: CompleteGoogleConnectorAuthInput): Promise<GoogleConnectorAuthResult>;
  advanceGoogleConnectorExport(
    input: AdvanceGoogleConnectorExportInput
  ): Promise<GoogleConnectorExportProgressResult>;
  uploadGoogleConnectorArchive(input: {
    connectorId: string;
    archiveFilePath: string;
    archiveFileName: string;
  }): Promise<GoogleConnectorArchiveImportResult>;
  openGoogleConnectorExportRoot(
    input: { connectorId: string }
  ): Promise<GoogleConnectorExportRootOpenResult>;
  checkGoogleConnectorExport(
    input: CheckGoogleConnectorExportInput
  ): Promise<GoogleConnectorExportCheckResult>;
  runConnectorInventory(connectorId: string): Promise<InventoryRunResult>;
  materializeImportBatch(input: MaterializeImportBatchInput): Promise<MaterializedImportBatch>;
  commitImportBatch(input: CommitImportBatchInput): Promise<CommittedImportBatch>;
}

export function createControlPlaneRuntime(
  repository: ControlPlaneRepository = createControlPlaneRepository()
): ControlPlaneRuntime {
  const googleExportGuideOrder: GoogleExportGuideState[] = [
    "handoff_ready",
    "categories_confirmed",
    "export_requested",
    "awaiting_archive",
    "files_detected",
    "inventory_started",
    "inventory_completed"
  ];

  function categoriesForExportSession(connector: Connector): Category[] {
    if (connector.authSession?.requestedCategories.length) {
      return connector.authSession.requestedCategories;
    }

    switch (connector.settings.inventoryProfile) {
      case "space_warning":
        return ["mail", "files"];
      case "google_core":
      default:
        return ["photos", "mail", "geolocation"];
    }
  }

  function createAwaitingGoogleExportSession(
    connector: Connector,
    existingSession: GoogleConnectorExportSession | null = null
  ): GoogleConnectorExportSession {
    const exportRootPath =
      typeof connector.settings.rootPath === "string" ? connector.settings.rootPath : "";
    const waitingStartedAt = existingSession?.waitingStartedAt ?? new Date().toISOString();
    const handoffPlan =
      exportRootPath.trim() === ""
        ? null
        : createGoogleExportHandoffPlan({
            connectorId: connector.connectorId,
            exportRootPath,
            requestedCategories: categoriesForExportSession(connector),
            handoffUrl: connector.authSession?.continueUrl ?? existingSession?.handoffUrl ?? null
          });

    return {
      sessionId: existingSession?.sessionId ?? randomUUID(),
      connectorId: connector.connectorId,
      status: "awaiting_files",
      exportRootPath,
      handoffUrl: handoffPlan?.handoffUrl ?? connector.authSession?.continueUrl ?? existingSession?.handoffUrl ?? null,
      archiveExpectation:
        handoffPlan?.archiveExpectation ?? existingSession?.archiveExpectation ?? null,
      orchestrationSteps:
        handoffPlan?.orchestrationSteps ?? existingSession?.orchestrationSteps ?? [],
      watchFolderReadyAt: existingSession?.watchFolderReadyAt ?? null,
      guideState: existingSession?.guideState ?? "handoff_ready",
      categoriesConfirmedAt: existingSession?.categoriesConfirmedAt ?? null,
      exportRequestedAt: existingSession?.exportRequestedAt ?? null,
      awaitingArchiveAt: existingSession?.awaitingArchiveAt ?? null,
      requestedCategories: categoriesForExportSession(connector),
      waitingStartedAt,
      lastCheckedAt: existingSession?.lastCheckedAt ?? null,
      detectedAt: null,
      detectedItemCount: null,
      detectedCategories: [],
      autoInventoryStartedAt: null,
      inventoryCompletedAt: null
    };
  }

  function exportStateForSessionStatus(
    status: GoogleConnectorExportSession["status"]
  ): "awaiting_files" | "files_detected" | "inventory_started" | "inventory_completed" {
    switch (status) {
      case "files_detected":
      case "inventory_started":
      case "inventory_completed":
        return status;
      case "awaiting_files":
      default:
        return "awaiting_files";
    }
  }

  function promoteGuideState(
    current: GoogleExportGuideState,
    target: GoogleExportGuideState
  ): GoogleExportGuideState {
    return googleExportGuideOrder.indexOf(target) > googleExportGuideOrder.indexOf(current)
      ? target
      : current;
  }

  function applyGoogleExportGuideAction(
    session: GoogleConnectorExportSession,
    action: GoogleExportGuideAction
  ): GoogleConnectorExportSession {
    const now = new Date().toISOString();

    switch (action) {
      case "confirm_categories":
        return {
          ...session,
          guideState: promoteGuideState(session.guideState, "categories_confirmed"),
          categoriesConfirmedAt: session.categoriesConfirmedAt ?? now
        };
      case "mark_export_created":
        return {
          ...session,
          guideState: promoteGuideState(session.guideState, "export_requested"),
          categoriesConfirmedAt: session.categoriesConfirmedAt ?? now,
          exportRequestedAt: session.exportRequestedAt ?? now
        };
      case "mark_waiting_for_archive":
        return {
          ...session,
          guideState: promoteGuideState(session.guideState, "awaiting_archive"),
          categoriesConfirmedAt: session.categoriesConfirmedAt ?? now,
          exportRequestedAt: session.exportRequestedAt ?? now,
          awaitingArchiveAt: session.awaitingArchiveAt ?? now
        };
      default:
        return session;
    }
  }

  function openPathInDesktop(path: string) {
    if (process.env.ANCHISE_DISABLE_DESKTOP_OPEN === "1") {
      return;
    }

    let command: string;
    switch (process.platform) {
      case "win32":
        command = "explorer.exe";
        break;
      case "darwin":
        command = "open";
        break;
      default:
        command = "xdg-open";
        break;
    }

    const child = spawn(command, [path], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
  }

  function quotedPowerShellLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  async function runCommand(command: string, args: string[], errorMessage: string): Promise<void> {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        stdio: "ignore"
      });

      child.on("error", (error) => {
        rejectPromise(
          new ControlPlaneInputError(`${errorMessage}: ${error instanceof Error ? error.message : "Unknown error"}`)
        );
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolvePromise();
          return;
        }

        rejectPromise(
          new ControlPlaneInputError(
            `${errorMessage}: command exited with code ${code === null ? "unknown" : code}.`
          )
        );
      });
    });
  }

  async function extractArchiveToDirectory(
    archiveFilePath: string,
    destinationPath: string
  ): Promise<void> {
    const archiveName = basename(archiveFilePath).toLowerCase();
    const extractionError = `Anchise could not extract ${basename(archiveFilePath)}`;

    if (archiveName.endsWith(".zip")) {
      if (process.platform === "win32") {
        await runCommand(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Expand-Archive -LiteralPath ${quotedPowerShellLiteral(
              archiveFilePath
            )} -DestinationPath ${quotedPowerShellLiteral(destinationPath)} -Force`
          ],
          extractionError
        );
        return;
      }

      if (process.platform === "darwin") {
        await runCommand("ditto", ["-x", "-k", archiveFilePath, destinationPath], extractionError);
        return;
      }

      await runCommand("unzip", ["-o", archiveFilePath, "-d", destinationPath], extractionError);
      return;
    }

    if (archiveName.endsWith(".tar.gz") || archiveName.endsWith(".tgz")) {
      await runCommand("tar", ["-xzf", archiveFilePath, "-C", destinationPath], extractionError);
      return;
    }

    if (archiveName.endsWith(".tar")) {
      await runCommand("tar", ["-xf", archiveFilePath, "-C", destinationPath], extractionError);
      return;
    }

    throw new ControlPlaneInputError(
      "Supported Google export archive types are .zip, .tgz, .tar.gz, and .tar."
    );
  }

  function resolveExportRootPath(rootPath: string): string {
    return isAbsolute(rootPath) ? rootPath : resolve(rootPath);
  }

  async function prepareGoogleExportHandoffSession(
    connector: Connector
  ): Promise<GoogleConnectorExportSession | null> {
    const configuredRootPath = connector.settings.rootPath;
    if (typeof configuredRootPath !== "string" || configuredRootPath.trim() === "") {
      return connector.exportSession ?? null;
    }

    const exportRootPath = resolveExportRootPath(configuredRootPath);
    await mkdir(exportRootPath, { recursive: true });
    const waitingSession = createAwaitingGoogleExportSession(connector, connector.exportSession);

    return {
      ...waitingSession,
      exportRootPath,
      handoffUrl: connector.authSession?.continueUrl ?? waitingSession.handoffUrl,
      watchFolderReadyAt: waitingSession.watchFolderReadyAt ?? new Date().toISOString()
    };
  }

  async function inspectGoogleExportStaging(
    connector: Connector
  ): Promise<GoogleConnectorExportCheckResult> {
    const waitingSession = connector.exportSession ?? createAwaitingGoogleExportSession(connector);
    const waitingConnector = await repository.persistGoogleExportSession({
      connectorId: connector.connectorId,
      exportState: "awaiting_files",
      session: {
        ...waitingSession,
        lastCheckedAt: new Date().toISOString()
      }
    });

    const probe = await probeGoogleExportStaging(waitingConnector);
    if (probe.detectedSourceItemCount === 0) {
      const refreshedConnector = await repository.persistGoogleExportSession({
        connectorId: waitingConnector.connectorId,
        exportState: "awaiting_files",
        session: {
          ...(waitingConnector.exportSession ?? waitingSession),
          status: "awaiting_files",
          exportRootPath: probe.rootPath,
          requestedCategories: categoriesForExportSession(waitingConnector),
          lastCheckedAt: new Date().toISOString(),
          detectedAt: null,
          detectedItemCount: null,
          detectedCategories: [],
          autoInventoryStartedAt: null,
          inventoryCompletedAt: null
        }
      });

      if (!refreshedConnector.exportSession) {
        throw new ControlPlaneInputError(
          "Google export waiting session did not persist a connector session."
        );
      }

      return {
        connector: refreshedConnector,
        session: refreshedConnector.exportSession,
        inventoryRun: null
      };
    }

    const detectedConnector = await repository.persistGoogleExportSession({
      connectorId: waitingConnector.connectorId,
      exportState: "files_detected",
      session: {
        ...(waitingConnector.exportSession ?? waitingSession),
        status: "files_detected",
        guideState: "files_detected",
        exportRootPath: probe.rootPath,
        requestedCategories: categoriesForExportSession(waitingConnector),
        lastCheckedAt: new Date().toISOString(),
        detectedAt: waitingConnector.exportSession?.detectedAt ?? new Date().toISOString(),
        detectedItemCount: probe.detectedSourceItemCount,
        detectedCategories: probe.detectedCategories
      }
    });

    const inventoryRun = await executeConnectorInventory(detectedConnector.connectorId);
    const completedConnector = await repository.getConnector(detectedConnector.connectorId);

    if (!completedConnector?.exportSession) {
      throw new ControlPlaneInputError(
        "Google export auto-inventory completed without a persisted export session."
      );
    }

    return {
      connector: completedConnector,
      session: completedConnector.exportSession,
      inventoryRun
    };
  }

  async function executeConnectorInventory(connectorId: string): Promise<InventoryRunResult> {
    const connector = await repository.getConnector(connectorId);
    if (!connector) {
      throw new ControlPlaneInputError(`Connector ${connectorId} does not exist.`);
    }

    if (connector.platform === "google" && connector.authState !== "authenticated") {
      throw new ControlPlaneInputError(
        "Google inventory requires the visible sign-in lane to be completed first."
      );
    }

    const workspace = await repository.getWorkspace(connector.workspaceId);
    if (!workspace) {
      throw new ControlPlaneInputError(
        `Workspace ${connector.workspaceId} for connector ${connectorId} does not exist.`
      );
    }

      if (connector.platform === "google" && connector.exportSession) {
        await repository.persistGoogleExportSession({
          connectorId,
          exportState: "inventory_started",
          session: {
            ...connector.exportSession,
            status: "inventory_started",
            guideState: "inventory_started",
            lastCheckedAt: new Date().toISOString(),
            detectedAt: connector.exportSession.detectedAt ?? new Date().toISOString(),
            autoInventoryStartedAt:
            connector.exportSession.autoInventoryStartedAt ?? new Date().toISOString()
        }
      });
    }

    await repository.setConnectorState({
      connectorId,
      toState: "inventorying",
      trigger: "inventory_requested",
      details: {
        platform: connector.platform,
        surface: connector.surface
      },
      lastError: null
    });

    try {
      const adapter = getInventoryAdapter(connector.platform);
      const inventory = await adapter.run({ connector, workspace });
      const saved = await repository.captureInventory({
        connectorId,
        categories: inventory.categories,
        comparison: inventory.comparison,
        generatedAt: inventory.generatedAt,
        sourceItems: inventory.sourceItems
      });

      if (connector.platform === "google") {
        const refreshedConnector = await repository.getConnector(connectorId);
        const exportSession =
          refreshedConnector?.exportSession ?? createAwaitingGoogleExportSession(connector);

        await repository.persistGoogleExportSession({
          connectorId,
          exportState: "inventory_completed",
          session: {
            ...exportSession,
            status: "inventory_completed",
            guideState: "inventory_completed",
            lastCheckedAt: new Date().toISOString(),
            detectedAt: exportSession.detectedAt ?? new Date().toISOString(),
            detectedItemCount: saved.sourceItems.length,
            detectedCategories: [
              ...new Set(saved.sourceItems.map((item) => item.category))
            ].sort((left, right) => left.localeCompare(right)),
            autoInventoryStartedAt:
              exportSession.autoInventoryStartedAt ?? new Date().toISOString(),
            inventoryCompletedAt: new Date().toISOString()
          }
        });
      }

      return {
        snapshot: saved.snapshot,
        discoveredItemCount: saved.sourceItems.length,
        deferredItemCount: saved.sourceItems.filter(
          (item) => item.downloadDisposition === "defer"
        ).length,
        strategyLabel: inventory.strategyLabel
      };
    } catch (error) {
      await repository.setConnectorState({
        connectorId,
        toState: "error",
        trigger: "inventory_failed",
        details: {
          message: error instanceof Error ? error.message : "Unknown inventory error"
        },
        lastError: error instanceof Error ? error.message : "Unknown inventory error"
      });

      throw error;
    }
  }

  return {
    async prepareGoogleConnectorAuth(input) {
      const connector = await repository.getConnector(input.connectorId);
      if (!connector) {
        throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
      }

      if (connector.platform !== "google") {
        throw new ControlPlaneInputError(
          "Visible Google sign-in can only be prepared for Google connectors."
        );
      }

      const session = createGoogleBrowserLanePlan({
        connectorId: connector.connectorId,
        sessionId: randomUUID(),
        inventoryProfile: connector.settings.inventoryProfile
      });

      const updatedConnector = await repository.persistGoogleAuthSession({
        connectorId: connector.connectorId,
        session: {
          ...session,
          authenticatedAt: null,
          status: "prepared"
        }
      });

      if (!updatedConnector.authSession) {
        throw new ControlPlaneInputError(
          "Google auth preparation did not persist a connector session."
        );
      }

      return {
        connector: updatedConnector,
        session: updatedConnector.authSession
      };
    },

    async completeGoogleConnectorAuth(input) {
      const updatedConnector = await repository.completeGoogleAuthSession(input);

      if (!updatedConnector.authSession) {
        throw new ControlPlaneInputError(
          "Google auth completion did not produce a connector session."
        );
      }

      const preparedExportSession = await prepareGoogleExportHandoffSession(updatedConnector);
      if (preparedExportSession) {
        const connectorWithExportSession = await repository.persistGoogleExportSession({
          connectorId: updatedConnector.connectorId,
          exportState: "awaiting_files",
          session: preparedExportSession
        });

        return {
          connector: connectorWithExportSession,
          session: connectorWithExportSession.authSession ?? updatedConnector.authSession
        };
      }

      return {
        connector: updatedConnector,
        session: updatedConnector.authSession
      };
    },

    async advanceGoogleConnectorExport(input) {
      const connector = await repository.getConnector(input.connectorId);
      if (!connector) {
        throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
      }

      if (connector.platform !== "google") {
        throw new ControlPlaneInputError(
          "Google export progress can only be advanced for Google connectors."
        );
      }

      if (connector.authState !== "authenticated") {
        throw new ControlPlaneInputError(
          "Google export progress requires the visible sign-in lane to be completed first."
        );
      }

      const preparedExportSession =
        (await prepareGoogleExportHandoffSession(connector)) ??
        connector.exportSession ??
        createAwaitingGoogleExportSession(connector);
      const nextSession = applyGoogleExportGuideAction(preparedExportSession, input.action);
      const updatedConnector = await repository.persistGoogleExportSession({
        connectorId: connector.connectorId,
        exportState: exportStateForSessionStatus(nextSession.status),
        session: nextSession
      });

      if (!updatedConnector.exportSession) {
        throw new ControlPlaneInputError(
          "Google export progress update did not persist a connector session."
        );
      }

      return {
        connector: updatedConnector,
        session: updatedConnector.exportSession
      };
    },

    async uploadGoogleConnectorArchive(input) {
      const connector = await repository.getConnector(input.connectorId);
      if (!connector) {
        throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
      }

      if (connector.platform !== "google") {
        throw new ControlPlaneInputError(
          "Google archive upload can only be used for Google connectors."
        );
      }

      if (connector.authState !== "authenticated") {
        throw new ControlPlaneInputError(
          "Google archive upload requires the visible sign-in lane to be completed first."
        );
      }

      const preparedExportSession = await prepareGoogleExportHandoffSession(connector);
      if (!preparedExportSession) {
        throw new ControlPlaneInputError(
          "Set a Google export root before uploading a Google archive."
        );
      }

      await extractArchiveToDirectory(
        input.archiveFilePath,
        preparedExportSession.exportRootPath
      );

      const now = new Date().toISOString();
      const stagedConnector = await repository.persistGoogleExportSession({
        connectorId: connector.connectorId,
        exportState: exportStateForSessionStatus(preparedExportSession.status),
        session: {
          ...preparedExportSession,
          guideState: promoteGuideState(preparedExportSession.guideState, "awaiting_archive"),
          categoriesConfirmedAt: preparedExportSession.categoriesConfirmedAt ?? now,
          exportRequestedAt: preparedExportSession.exportRequestedAt ?? now,
          awaitingArchiveAt: preparedExportSession.awaitingArchiveAt ?? now
        }
      });

      const stagedResult = await inspectGoogleExportStaging(stagedConnector);

      return {
        connector: stagedResult.connector,
        session: stagedResult.session,
        inventoryRun: stagedResult.inventoryRun,
        uploadedFileName: input.archiveFileName,
        extractedAt: now
      };
    },

    async openGoogleConnectorExportRoot(input) {
      const connector = await repository.getConnector(input.connectorId);
      if (!connector) {
        throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
      }

      if (connector.platform !== "google") {
        throw new ControlPlaneInputError(
          "Google export root can only be opened for Google connectors."
        );
      }

      const preparedExportSession = await prepareGoogleExportHandoffSession(connector);
      if (!preparedExportSession) {
        throw new ControlPlaneInputError(
          "Set a Google export root before trying to open the watch folder."
        );
      }

      const updatedConnector = await repository.persistGoogleExportSession({
        connectorId: connector.connectorId,
        exportState: exportStateForSessionStatus(preparedExportSession.status),
        session: preparedExportSession
      });

      if (!updatedConnector.exportSession) {
        throw new ControlPlaneInputError(
          "Opening the Google export root did not persist a connector session."
        );
      }

      openPathInDesktop(updatedConnector.exportSession.exportRootPath);

      return {
        connector: updatedConnector,
        session: updatedConnector.exportSession,
        openedPath: updatedConnector.exportSession.exportRootPath
      };
    },

    async checkGoogleConnectorExport(input) {
      const connector = await repository.getConnector(input.connectorId);
      if (!connector) {
        throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
      }

      if (connector.platform !== "google") {
        throw new ControlPlaneInputError(
          "Google export checks can only be run for Google connectors."
        );
      }

      if (connector.authState !== "authenticated") {
        throw new ControlPlaneInputError(
          "Google export checks require the visible sign-in lane to be completed first."
        );
      }
      return inspectGoogleExportStaging(connector);
    },

    async runConnectorInventory(connectorId) {
      return executeConnectorInventory(connectorId);
    },

    materializeImportBatch(input) {
      return repository.materializeImportBatch(input);
    },

    commitImportBatch(input) {
      return repository.commitImportBatch(input);
    }
  };
}
