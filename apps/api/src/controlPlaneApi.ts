import type {
  AdvanceGoogleConnectorExportRequest,
  CheckGoogleConnectorExportRequest,
  CommitImportBatchRequest,
  CategoryInventory,
  CommittedImportBatch,
  CompleteGoogleConnectorAuthRequest,
  ConfirmImportPlanRequest,
  Connector,
  CreateWorkspaceRequest,
  DraftImportPlanRequest,
  GetWorkspaceRequest,
  GoogleConnectorAuthResult,
  GoogleConnectorExportCheckResult,
  GoogleConnectorExportProgressResult,
  GoogleConnectorExportRootOpenResult,
  InventoryRunResult,
  InventorySnapshot,
  ListConnectorsRequest,
  MaterializeImportBatchRequest,
  MaterializedImportBatch,
  OpenGoogleConnectorExportRootRequest,
  PrepareGoogleConnectorAuthRequest,
  RecordInventorySnapshotRequest,
  RegisterConnectorRequest,
  RunConnectorInventoryRequest,
  StorageComparison,
  Workspace
} from "@anchise/contracts";

import {
  ControlPlaneInputError,
  createControlPlaneRepository,
  type ControlPlaneRepository
} from "./controlPlaneRepository.js";
import { createControlPlaneRuntime, type ControlPlaneRuntime } from "./controlPlaneRuntime.js";
import {
  failure,
  isRecord,
  ok,
  readOptionalEnum,
  readOptionalString,
  readRequiredEnum,
  readRequiredNumber,
  readRequiredString,
  type JsonResponse
} from "./http.js";

const planStates = ["trial", "active", "limited"] as const;
const agentStates = ["not_installed", "paired", "action_needed"] as const;
const connectorPlatforms = ["google", "local_hardware"] as const;
const connectorSurfaces = ["browser_account", "local_folder"] as const;
const extractionStrategies = ["api", "browser", "export", "physical", "local"] as const;
const deleteCapabilities = [
  "direct_delete",
  "deletion_request",
  "account_deletion_only",
  "download_only"
] as const;
const categories = ["photos", "mail", "files", "contacts", "geolocation"] as const;
const fitStates = ["fits", "likely_exceeds", "exceeds", "unknown"] as const;
const sourceActions = ["download_only", "download_and_delete_source"] as const;
const modes = ["incremental"] as const;
const googleExportGuideActions = [
  "confirm_categories",
  "mark_export_created",
  "mark_waiting_for_archive"
] as const;

function invalidJson(): JsonResponse<never> {
  return failure("invalid_request", "Request body must be a JSON object.");
}

function parseCreateWorkspaceRequest(input: unknown): CreateWorkspaceRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const ownerId = readRequiredString(input.ownerId, "ownerId");
  if (typeof ownerId !== "string") {
    return ownerId;
  }

  const storageCapacityBytes = readRequiredNumber(
    input.storageCapacityBytes,
    "storageCapacityBytes"
  );
  if (typeof storageCapacityBytes !== "number") {
    return storageCapacityBytes;
  }

  const planState = readOptionalEnum(input.planState, "planState", planStates);
  if (planState && typeof planState !== "string") {
    return planState;
  }

  const agentState = readOptionalEnum(input.agentState, "agentState", agentStates);
  if (agentState && typeof agentState !== "string") {
    return agentState;
  }

  return {
    ownerId,
    storageCapacityBytes,
    planState,
    agentState
  };
}

function parseGetWorkspaceRequest(input: unknown): GetWorkspaceRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const workspaceId = readRequiredString(input.workspaceId, "workspaceId");
  if (typeof workspaceId !== "string") {
    return workspaceId;
  }

  return { workspaceId };
}

function parseRegisterConnectorRequest(
  input: unknown
): RegisterConnectorRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const workspaceId = readRequiredString(input.workspaceId, "workspaceId");
  if (typeof workspaceId !== "string") {
    return workspaceId;
  }

  const platform = readRequiredEnum(input.platform, "platform", connectorPlatforms);
  if (typeof platform !== "string") {
    return platform;
  }

  const accountLabel = readRequiredString(input.accountLabel, "accountLabel");
  if (typeof accountLabel !== "string") {
    return accountLabel;
  }

  const surface = readRequiredEnum(input.surface, "surface", connectorSurfaces);
  if (typeof surface !== "string") {
    return surface;
  }

  const extractionStrategy = readOptionalEnum(
    input.extractionStrategy,
    "extractionStrategy",
    extractionStrategies
  );
  if (extractionStrategy && typeof extractionStrategy !== "string") {
    return extractionStrategy;
  }

  const deleteCapability = readOptionalEnum(
    input.deleteCapability,
    "deleteCapability",
    deleteCapabilities
  );
  if (deleteCapability && typeof deleteCapability !== "string") {
    return deleteCapability;
  }

  let settings: RegisterConnectorRequest["settings"] | undefined;
  if (input.settings !== undefined && input.settings !== null) {
    if (!isRecord(input.settings)) {
      return failure("invalid_request", "settings must be an object when provided.");
    }

    settings = {};

    const inventoryProfile = readOptionalString(input.settings.inventoryProfile, "settings.inventoryProfile");
    if (inventoryProfile && typeof inventoryProfile !== "string") {
      return inventoryProfile;
    }

    const rootPath = readOptionalString(input.settings.rootPath, "settings.rootPath");
    if (rootPath && typeof rootPath !== "string") {
      return rootPath;
    }

    const maxFiles =
      input.settings.maxFiles === null || input.settings.maxFiles === undefined
        ? undefined
        : readRequiredNumber(input.settings.maxFiles, "settings.maxFiles");
    if (maxFiles !== undefined && typeof maxFiles !== "number") {
      return maxFiles;
    }

    settings = {
      inventoryProfile: inventoryProfile ?? null,
      rootPath: rootPath ?? null,
      maxFiles: maxFiles ?? null
    };
  }

  return {
    workspaceId,
    platform,
    accountLabel,
    surface,
    extractionStrategy,
    deleteCapability,
    settings
  };
}

function parseListConnectorsRequest(
  input: unknown
): ListConnectorsRequest | JsonResponse<never> {
  return parseGetWorkspaceRequest(input);
}

function parseCategoryInventory(value: unknown): CategoryInventory | JsonResponse<never> {
  if (!isRecord(value)) {
    return failure("invalid_request", "Each category inventory entry must be an object.");
  }

  const category = readRequiredEnum(value.category, "categories[].category", categories);
  if (typeof category !== "string") {
    return category;
  }

  const itemCountEstimate =
    value.itemCountEstimate === null || value.itemCountEstimate === undefined
      ? null
      : readRequiredNumber(value.itemCountEstimate, "categories[].itemCountEstimate");
  if (itemCountEstimate !== null && typeof itemCountEstimate !== "number") {
    return itemCountEstimate;
  }

  const bytesEstimate =
    value.bytesEstimate === null || value.bytesEstimate === undefined
      ? null
      : readRequiredNumber(value.bytesEstimate, "categories[].bytesEstimate");
  if (bytesEstimate !== null && typeof bytesEstimate !== "number") {
    return bytesEstimate;
  }

  const duplicateBytesEstimate =
    value.duplicateBytesEstimate === null || value.duplicateBytesEstimate === undefined
      ? null
      : readRequiredNumber(value.duplicateBytesEstimate, "categories[].duplicateBytesEstimate");
  if (duplicateBytesEstimate !== null && typeof duplicateBytesEstimate !== "number") {
    return duplicateBytesEstimate;
  }

  if (typeof value.importSupported !== "boolean") {
    return failure("invalid_request", "categories[].importSupported must be a boolean.");
  }

  if (typeof value.incrementalSupported !== "boolean") {
    return failure(
      "invalid_request",
      "categories[].incrementalSupported must be a boolean."
    );
  }

  const dateRangeStart = readOptionalString(value.dateRangeStart, "categories[].dateRangeStart");
  if (dateRangeStart && typeof dateRangeStart !== "string") {
    return dateRangeStart;
  }

  const dateRangeEnd = readOptionalString(value.dateRangeEnd, "categories[].dateRangeEnd");
  if (dateRangeEnd && typeof dateRangeEnd !== "string") {
    return dateRangeEnd;
  }

  return {
    category,
    itemCountEstimate,
    bytesEstimate,
    duplicateBytesEstimate,
    netNewBytesEstimate:
      bytesEstimate === null
        ? null
        : Math.max(bytesEstimate - (duplicateBytesEstimate ?? 0), 0),
    importSupported: value.importSupported,
    incrementalSupported: value.incrementalSupported,
    dateRangeStart: dateRangeStart ?? null,
    dateRangeEnd: dateRangeEnd ?? null
  };
}

function parseStorageComparison(value: unknown): StorageComparison | JsonResponse<never> {
  if (!isRecord(value)) {
    return failure("invalid_request", "comparison must be an object.");
  }

  const sourceBytesEstimate =
    value.sourceBytesEstimate === null || value.sourceBytesEstimate === undefined
      ? null
      : readRequiredNumber(value.sourceBytesEstimate, "comparison.sourceBytesEstimate");
  if (sourceBytesEstimate !== null && typeof sourceBytesEstimate !== "number") {
    return sourceBytesEstimate;
  }

  const netNewBytesEstimate =
    value.netNewBytesEstimate === null || value.netNewBytesEstimate === undefined
      ? null
      : readRequiredNumber(value.netNewBytesEstimate, "comparison.netNewBytesEstimate");
  if (netNewBytesEstimate !== null && typeof netNewBytesEstimate !== "number") {
    return netNewBytesEstimate;
  }

  const existingAnchiseBytesEstimate =
    value.existingAnchiseBytesEstimate === null ||
    value.existingAnchiseBytesEstimate === undefined
      ? null
      : readRequiredNumber(
          value.existingAnchiseBytesEstimate,
          "comparison.existingAnchiseBytesEstimate"
        );
  if (
    existingAnchiseBytesEstimate !== null &&
    typeof existingAnchiseBytesEstimate !== "number"
  ) {
    return existingAnchiseBytesEstimate;
  }

  const availableAnchiseBytes =
    value.availableAnchiseBytes === null || value.availableAnchiseBytes === undefined
      ? null
      : readRequiredNumber(value.availableAnchiseBytes, "comparison.availableAnchiseBytes");
  if (availableAnchiseBytes !== null && typeof availableAnchiseBytes !== "number") {
    return availableAnchiseBytes;
  }

  const fitState = readRequiredEnum(value.fitState, "comparison.fitState", fitStates);
  if (typeof fitState !== "string") {
    return fitState;
  }

  return {
    sourceBytesEstimate,
    netNewBytesEstimate,
    existingAnchiseBytesEstimate,
    availableAnchiseBytes,
    fitState
  };
}

function parseRecordInventorySnapshotRequest(
  input: unknown
): RecordInventorySnapshotRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  if (!Array.isArray(input.categories)) {
    return failure("invalid_request", "categories must be an array.");
  }

  const parsedCategories: CategoryInventory[] = [];
  for (const entry of input.categories) {
    const parsed = parseCategoryInventory(entry);
    if (!("category" in parsed)) {
      return parsed;
    }

    parsedCategories.push(parsed);
  }

  const comparison = parseStorageComparison(input.comparison);
  if (!("fitState" in comparison)) {
    return comparison;
  }

  const generatedAt = readOptionalString(input.generatedAt, "generatedAt");
  if (generatedAt && typeof generatedAt !== "string") {
    return generatedAt;
  }

  return {
    connectorId,
    categories: parsedCategories,
    comparison,
    generatedAt
  };
}

function parseDraftImportPlanRequest(
  input: unknown
): DraftImportPlanRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const workspaceId = readRequiredString(input.workspaceId, "workspaceId");
  if (typeof workspaceId !== "string") {
    return workspaceId;
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  const snapshotId = readRequiredString(input.snapshotId, "snapshotId");
  if (typeof snapshotId !== "string") {
    return snapshotId;
  }

  if (!Array.isArray(input.categories) || input.categories.length === 0) {
    return failure("invalid_request", "categories must be a non-empty array.");
  }

  const parsedCategories: DraftImportPlanRequest["categories"] = [];
  for (const entry of input.categories) {
    const category = readRequiredEnum(entry, "categories[]", categories);
    if (typeof category !== "string") {
      return category;
    }

    if (!parsedCategories.includes(category)) {
      parsedCategories.push(category);
    }
  }

  const mode = readOptionalEnum(input.mode, "mode", modes);
  if (mode && typeof mode !== "string") {
    return mode;
  }

  const sourceAction = readRequiredEnum(input.sourceAction, "sourceAction", sourceActions);
  if (typeof sourceAction !== "string") {
    return sourceAction;
  }

  return {
    workspaceId,
    connectorId,
    snapshotId,
    categories: parsedCategories,
    mode,
    sourceAction
  };
}

function parseConfirmImportPlanRequest(
  input: unknown
): ConfirmImportPlanRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const planId = readRequiredString(input.planId, "planId");
  if (typeof planId !== "string") {
    return planId;
  }

  return { planId };
}

function parsePrepareGoogleConnectorAuthRequest(
  input: unknown
): PrepareGoogleConnectorAuthRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  return { connectorId };
}

function parseCompleteGoogleConnectorAuthRequest(
  input: unknown
): CompleteGoogleConnectorAuthRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  const sessionId = readRequiredString(input.sessionId, "sessionId");
  if (typeof sessionId !== "string") {
    return sessionId;
  }

  return {
    connectorId,
    sessionId
  };
}

function parseCheckGoogleConnectorExportRequest(
  input: unknown
): CheckGoogleConnectorExportRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  return { connectorId };
}

function parseAdvanceGoogleConnectorExportRequest(
  input: unknown
): AdvanceGoogleConnectorExportRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  const action = readRequiredEnum(input.action, "action", googleExportGuideActions);
  if (typeof action !== "string") {
    return action;
  }

  return {
    connectorId,
    action
  };
}

function parseOpenGoogleConnectorExportRootRequest(
  input: unknown
): OpenGoogleConnectorExportRootRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  return { connectorId };
}

function parseRunConnectorInventoryRequest(
  input: unknown
): RunConnectorInventoryRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const connectorId = readRequiredString(input.connectorId, "connectorId");
  if (typeof connectorId !== "string") {
    return connectorId;
  }

  return { connectorId };
}

function parseMaterializeImportBatchRequest(
  input: unknown
): MaterializeImportBatchRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const planId = readRequiredString(input.planId, "planId");
  if (typeof planId !== "string") {
    return planId;
  }

  const batchSize =
    input.batchSize === null || input.batchSize === undefined
      ? undefined
      : readRequiredNumber(input.batchSize, "batchSize");
  if (batchSize !== undefined && typeof batchSize !== "number") {
    return batchSize;
  }

  return {
    planId,
    batchSize
  };
}

function parseCommitImportBatchRequest(
  input: unknown
): CommitImportBatchRequest | JsonResponse<never> {
  if (!isRecord(input)) {
    return invalidJson();
  }

  const batchId = readRequiredString(input.batchId, "batchId");
  if (typeof batchId !== "string") {
    return batchId;
  }

  if (!Array.isArray(input.objects) || input.objects.length === 0) {
    return failure("invalid_request", "objects must be a non-empty array.");
  }

  const objects: CommitImportBatchRequest["objects"] = [];
  for (const [index, value] of input.objects.entries()) {
    if (!isRecord(value)) {
      return failure("invalid_request", `objects[${index}] must be an object.`);
    }

    const sourceItemId = readRequiredString(value.sourceItemId, `objects[${index}].sourceItemId`);
    if (typeof sourceItemId !== "string") {
      return sourceItemId;
    }

    const contentHash = readRequiredString(value.contentHash, `objects[${index}].contentHash`);
    if (typeof contentHash !== "string") {
      return contentHash;
    }

    const byteSize = readRequiredNumber(value.byteSize, `objects[${index}].byteSize`);
    if (typeof byteSize !== "number") {
      return byteSize;
    }

    const storedByteSize =
      value.storedByteSize === null || value.storedByteSize === undefined
        ? undefined
        : readRequiredNumber(value.storedByteSize, `objects[${index}].storedByteSize`);
    if (storedByteSize !== undefined && typeof storedByteSize !== "number") {
      return storedByteSize;
    }

    const mimeType = readRequiredString(value.mimeType, `objects[${index}].mimeType`);
    if (typeof mimeType !== "string") {
      return mimeType;
    }

    const title = readOptionalString(value.title, `objects[${index}].title`);
    if (title && typeof title !== "string") {
      return title;
    }

    const summary = readOptionalString(value.summary, `objects[${index}].summary`);
    if (summary && typeof summary !== "string") {
      return summary;
    }

    const originalAt = readOptionalString(value.originalAt, `objects[${index}].originalAt`);
    if (originalAt && typeof originalAt !== "string") {
      return originalAt;
    }

    if (value.hasLocation !== undefined && value.hasLocation !== null && typeof value.hasLocation !== "boolean") {
      return failure("invalid_request", `objects[${index}].hasLocation must be a boolean when provided.`);
    }

    if (value.sourceMetadata !== undefined && value.sourceMetadata !== null && !isRecord(value.sourceMetadata)) {
      return failure("invalid_request", `objects[${index}].sourceMetadata must be an object when provided.`);
    }

    objects.push({
      sourceItemId,
      contentHash,
      byteSize,
      storedByteSize,
      mimeType,
      title,
      summary,
      originalAt: originalAt ?? null,
      hasLocation: value.hasLocation === true,
      sourceMetadata: value.sourceMetadata ? value.sourceMetadata : undefined
    });
  }

  return {
    batchId,
    objects
  };
}

function unexpectedError(error: unknown): JsonResponse<never> {
  console.error(error);
  return failure("internal_error", "Unexpected control-plane error.", 500);
}

function mapError(error: unknown): JsonResponse<never> {
  if (error instanceof ControlPlaneInputError) {
    return failure("invalid_request", error.message, 400);
  }

  return unexpectedError(error);
}

export interface ControlPlaneApi {
  createWorkspace(body: unknown): Promise<JsonResponse<Workspace>>;
  getWorkspace(body: unknown): Promise<JsonResponse<Workspace>>;
  registerConnector(body: unknown): Promise<JsonResponse<Connector>>;
  listConnectors(body: unknown): Promise<JsonResponse<Connector[]>>;
  prepareGoogleConnectorAuth(body: unknown): Promise<JsonResponse<GoogleConnectorAuthResult>>;
  completeGoogleConnectorAuth(body: unknown): Promise<JsonResponse<GoogleConnectorAuthResult>>;
  checkGoogleConnectorExport(body: unknown): Promise<JsonResponse<GoogleConnectorExportCheckResult>>;
  advanceGoogleConnectorExport(
    body: unknown
  ): Promise<JsonResponse<GoogleConnectorExportProgressResult>>;
  openGoogleConnectorExportRoot(
    body: unknown
  ): Promise<JsonResponse<GoogleConnectorExportRootOpenResult>>;
  recordInventorySnapshot(body: unknown): Promise<JsonResponse<InventorySnapshot>>;
  draftImportPlan(body: unknown): Promise<JsonResponse<import("@anchise/contracts").ImportPlan>>;
  confirmImportPlan(body: unknown): Promise<JsonResponse<import("@anchise/contracts").ImportPlan>>;
  runConnectorInventory(body: unknown): Promise<JsonResponse<InventoryRunResult>>;
  materializeImportBatch(body: unknown): Promise<JsonResponse<MaterializedImportBatch>>;
  commitImportBatch(body: unknown): Promise<JsonResponse<CommittedImportBatch>>;
}

export function createControlPlaneApi(
  repository: ControlPlaneRepository = createControlPlaneRepository(),
  runtime: ControlPlaneRuntime = createControlPlaneRuntime(repository)
): ControlPlaneApi {
  return {
    async createWorkspace(body) {
      const parsed = parseCreateWorkspaceRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await repository.createWorkspace(parsed), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async getWorkspace(body) {
      const parsed = parseGetWorkspaceRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        const workspace = await repository.getWorkspace(parsed.workspaceId);

        if (!workspace) {
          return failure("not_found", `Workspace ${parsed.workspaceId} was not found.`, 404);
        }

        return ok(workspace);
      } catch (error) {
        return mapError(error);
      }
    },

    async registerConnector(body) {
      const parsed = parseRegisterConnectorRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await repository.registerConnector(parsed), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async listConnectors(body) {
      const parsed = parseListConnectorsRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await repository.listConnectors(parsed.workspaceId));
      } catch (error) {
        return mapError(error);
      }
    },

    async prepareGoogleConnectorAuth(body) {
      const parsed = parsePrepareGoogleConnectorAuthRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.prepareGoogleConnectorAuth(parsed), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async completeGoogleConnectorAuth(body) {
      const parsed = parseCompleteGoogleConnectorAuthRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.completeGoogleConnectorAuth(parsed));
      } catch (error) {
        return mapError(error);
      }
    },

    async checkGoogleConnectorExport(body) {
      const parsed = parseCheckGoogleConnectorExportRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.checkGoogleConnectorExport(parsed));
      } catch (error) {
        return mapError(error);
      }
    },

    async advanceGoogleConnectorExport(body) {
      const parsed = parseAdvanceGoogleConnectorExportRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.advanceGoogleConnectorExport(parsed));
      } catch (error) {
        return mapError(error);
      }
    },

    async openGoogleConnectorExportRoot(body) {
      const parsed = parseOpenGoogleConnectorExportRootRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.openGoogleConnectorExportRoot(parsed));
      } catch (error) {
        return mapError(error);
      }
    },

    async recordInventorySnapshot(body) {
      const parsed = parseRecordInventorySnapshotRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await repository.recordInventorySnapshot(parsed), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async draftImportPlan(body) {
      const parsed = parseDraftImportPlanRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await repository.draftImportPlan(parsed), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async confirmImportPlan(body) {
      const parsed = parseConfirmImportPlanRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await repository.confirmImportPlan(parsed.planId));
      } catch (error) {
        return mapError(error);
      }
    },

    async runConnectorInventory(body) {
      const parsed = parseRunConnectorInventoryRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.runConnectorInventory(parsed.connectorId), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async materializeImportBatch(body) {
      const parsed = parseMaterializeImportBatchRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.materializeImportBatch(parsed), 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async commitImportBatch(body) {
      const parsed = parseCommitImportBatchRequest(body);
      if ("status" in parsed) {
        return parsed;
      }

      try {
        return ok(await runtime.commitImportBatch(parsed));
      } catch (error) {
        return mapError(error);
      }
    }
  };
}
