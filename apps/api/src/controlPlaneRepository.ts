import { randomUUID } from "node:crypto";

import type {
  Category,
  CommitImportBatchInput,
  CommittedImportBatch,
  Connector,
  ConnectorAuthState,
  ConnectorExportState,
  ConnectorSettings,
  CreateWorkspaceInput,
  DiscoveredSourceItemInput,
  DraftImportPlanInput,
  GoogleConnectorAuthSession,
  GoogleConnectorExportSession,
  GoogleExportGuideState,
  ImportBatch,
  ImportPlan,
  InventorySnapshot,
  MaterializeImportBatchInput,
  MaterializedImportBatch,
  ObjectManifest,
  RecordInventorySnapshotInput,
  RegisterConnectorInput,
  SourceItem,
  Workspace
} from "@anchise/contracts";
import type { Sql } from "postgres";

import { getDb, getDbSchemaName } from "./db.js";

type NumericLike = number | string | bigint | null;
type TimestampLike = Date | string | null;

interface WorkspaceRow {
  id: string;
  owner_id: string;
  plan_state: Workspace["planState"];
  agent_state: Workspace["agentState"];
  storage_capacity_bytes: NumericLike;
  storage_used_bytes: NumericLike;
  created_at: TimestampLike;
}

interface ConnectorRow {
  id: string;
  workspace_id: string;
  platform: Connector["platform"];
  account_label: string;
  surface: Connector["surface"];
  state: Connector["state"];
  extraction_strategy: Connector["extractionStrategy"];
  delete_capability: Connector["deleteCapability"];
  settings: unknown;
  inventory_cursor: unknown;
  last_inventory_at: TimestampLike;
  last_error: string | null;
}

interface InventorySnapshotRow {
  id: string;
  connector_id: string;
  status: InventorySnapshot["status"];
  source_bytes_estimate: NumericLike;
  net_new_bytes_estimate: NumericLike;
  existing_anchise_bytes_estimate: NumericLike;
  available_anchise_bytes: NumericLike;
  fit_state: InventorySnapshot["comparison"]["fitState"];
  generated_at: TimestampLike;
}

interface InventoryCategoryRow {
  snapshot_id: string;
  category: Category;
  item_count_estimate: NumericLike;
  bytes_estimate: NumericLike;
  duplicate_bytes_estimate: NumericLike;
  import_supported: boolean;
  incremental_supported: boolean;
  date_range_start: TimestampLike;
  date_range_end: TimestampLike;
}

interface ImportPlanRow {
  id: string;
  workspace_id: string;
  connector_id: string;
  snapshot_id: string;
  selected_categories: unknown;
  mode: ImportPlan["mode"];
  source_action: ImportPlan["sourceAction"];
  source_bytes_estimate: NumericLike;
  net_new_bytes_estimate: NumericLike;
  available_anchise_bytes: NumericLike;
  fit_state: ImportPlan["fitState"];
  status: ImportPlan["status"];
  requested_at: TimestampLike;
  confirmed_at: TimestampLike;
}

interface SourceItemRow {
  id: string;
  connector_id: string;
  snapshot_id: string | null;
  category: Category;
  source_item_id: string;
  source_path: string | null;
  external_updated_at: TimestampLike;
  byte_size_estimate: NumericLike;
  content_hash_hint: string | null;
  mime_type: string | null;
  title: string | null;
  inventory_state: SourceItem["inventoryState"];
  download_disposition: SourceItem["downloadDisposition"];
  imported_object_id: string | null;
  metadata: unknown;
}

interface ImportBatchRow {
  id: string;
  plan_id: string;
  connector_id: string;
  ordinal: number;
  status: ImportBatch["status"];
  items_expected: NumericLike;
  items_received: NumericLike;
  bytes_planned: NumericLike;
  bytes_downloaded: NumericLike;
  bytes_uploaded: NumericLike;
  dedup_hits: NumericLike;
  dedup_bytes_skipped: NumericLike;
  started_at: TimestampLike;
  completed_at: TimestampLike;
  error: string | null;
}

interface ObjectManifestRow {
  id: string;
  workspace_id: string;
  connector_id: string;
  batch_id: string;
  category: Category;
  object_count: NumericLike;
  chunk_count: NumericLike;
  bytes_plain_estimate: NumericLike;
  bytes_stored: NumericLike;
  bytes_skipped_dedup: NumericLike;
  integrity_state: ObjectManifest["integrityState"];
  verification_at: TimestampLike;
  error: string | null;
  created_at: TimestampLike;
}

interface BatchSourceItemJoinRow extends SourceItemRow {
  batch_id: string;
  batch_ordinal: number;
  batch_status: "planned" | "committed" | "skipped_duplicate";
  planned_byte_size: NumericLike;
}

interface BatchPlanContextRow {
  batch_id: string;
  workspace_id: string;
  connector_id: string;
  account_label: string;
  selected_categories: unknown;
  plan_status: ImportPlan["status"];
}

interface InventoryCaptureInput extends RecordInventorySnapshotInput {
  sourceItems: DiscoveredSourceItemInput[];
}

interface ConnectorStateChange {
  connectorId: string;
  toState: Connector["state"];
  trigger: string;
  details?: Record<string, unknown>;
  lastError?: string | null;
  lastInventoryAt?: string | null;
}

interface PersistGoogleAuthSessionInput {
  connectorId: string;
  session: GoogleConnectorAuthSession;
}

interface PersistGoogleExportSessionInput {
  connectorId: string;
  session: GoogleConnectorExportSession;
  exportState: Extract<
    ConnectorExportState,
    "awaiting_files" | "files_detected" | "inventory_started" | "inventory_completed"
  >;
}

interface CompleteGoogleAuthSessionInput {
  connectorId: string;
  sessionId: GoogleConnectorAuthSession["sessionId"];
}

function toNumber(value: NumericLike): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function toRequiredNumber(value: NumericLike, fieldName: string): number {
  const parsed = toNumber(value);

  if (parsed === null) {
    throw new Error(`${fieldName} is unexpectedly null.`);
  }

  return parsed;
}

function toIso(value: TimestampLike): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseSelectedCategories(value: unknown): Category[] {
  if (Array.isArray(value)) {
    return value as Category[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as Category[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function guideStateFromExportStatus(
  status: GoogleConnectorExportSession["status"]
): GoogleExportGuideState {
  switch (status) {
    case "files_detected":
      return "files_detected";
    case "inventory_started":
      return "inventory_started";
    case "inventory_completed":
      return "inventory_completed";
    case "awaiting_files":
    default:
      return "handoff_ready";
  }
}

function parseGoogleExportGuideState(
  value: unknown,
  status: GoogleConnectorExportSession["status"]
): GoogleExportGuideState {
  switch (value) {
    case "handoff_ready":
    case "categories_confirmed":
    case "export_requested":
    case "awaiting_archive":
    case "files_detected":
    case "inventory_started":
    case "inventory_completed":
      return value;
    default:
      return guideStateFromExportStatus(status);
  }
}

function defaultAuthState(platform: Connector["platform"]): ConnectorAuthState {
  return platform === "google" ? "not_started" : "not_required";
}

function defaultExportState(platform: Connector["platform"]): ConnectorExportState {
  return platform === "google" ? "not_started" : "not_required";
}

function parseConnectorAuthState(
  platform: Connector["platform"],
  inventoryCursor: Record<string, unknown>
): ConnectorAuthState {
  if (platform !== "google") {
    return "not_required";
  }

  const googleAuth = toJsonObject(inventoryCursor.googleAuth);
  const authState = googleAuth.authState;

  switch (authState) {
    case "not_started":
    case "awaiting_user":
    case "authenticated":
    case "reauth_required":
      return authState;
    default:
      return "not_started";
  }
}

function parseConnectorExportState(
  platform: Connector["platform"],
  inventoryCursor: Record<string, unknown>
): ConnectorExportState {
  if (platform !== "google") {
    return "not_required";
  }

  const googleExport = toJsonObject(inventoryCursor.googleExport);
  const exportState = googleExport.exportState;

  switch (exportState) {
    case "not_started":
    case "awaiting_files":
    case "files_detected":
    case "inventory_started":
    case "inventory_completed":
      return exportState;
    default:
      return "not_started";
  }
}

function mapGoogleAuthSession(
  connectorId: string,
  inventoryCursor: Record<string, unknown>
): GoogleConnectorAuthSession | null {
  const googleAuth = toJsonObject(inventoryCursor.googleAuth);
  const sessionId = googleAuth.sessionId;
  const launchUrl = googleAuth.launchUrl;
  const continueUrl = googleAuth.continueUrl;
  const preparedAt = googleAuth.preparedAt;

  if (
    typeof sessionId !== "string" ||
    typeof launchUrl !== "string" ||
    typeof continueUrl !== "string" ||
    typeof preparedAt !== "string"
  ) {
    return null;
  }

  return {
    sessionId,
    connectorId,
    status:
      googleAuth.status === "authenticated" || googleAuth.status === "expired"
        ? googleAuth.status
        : "prepared",
    loginMode: "manual_visible_browser",
    continueUrl,
    launchUrl,
    requestedCategories: parseSelectedCategories(googleAuth.requestedCategories),
    preparedAt,
    authenticatedAt:
      typeof googleAuth.authenticatedAt === "string" ? googleAuth.authenticatedAt : null
  };
}

function mapGoogleExportSession(
  connectorId: string,
  inventoryCursor: Record<string, unknown>
): GoogleConnectorExportSession | null {
  const googleExport = toJsonObject(inventoryCursor.googleExport);
  const sessionId = googleExport.sessionId;
  const exportRootPath = googleExport.exportRootPath;
  const waitingStartedAt = googleExport.waitingStartedAt;

  if (
    typeof sessionId !== "string" ||
    typeof exportRootPath !== "string" ||
    typeof waitingStartedAt !== "string"
  ) {
    return null;
  }

  return {
    sessionId,
    connectorId,
    status:
      googleExport.status === "files_detected" ||
      googleExport.status === "inventory_started" ||
      googleExport.status === "inventory_completed"
        ? googleExport.status
        : "awaiting_files",
    exportRootPath,
    handoffUrl: typeof googleExport.handoffUrl === "string" ? googleExport.handoffUrl : null,
    archiveExpectation:
      typeof googleExport.archiveExpectation === "string"
        ? googleExport.archiveExpectation
        : null,
    orchestrationSteps: parseStringArray(googleExport.orchestrationSteps),
    watchFolderReadyAt:
      typeof googleExport.watchFolderReadyAt === "string"
        ? googleExport.watchFolderReadyAt
        : null,
    guideState: parseGoogleExportGuideState(
      googleExport.guideState,
      googleExport.status === "files_detected" ||
        googleExport.status === "inventory_started" ||
        googleExport.status === "inventory_completed"
        ? googleExport.status
        : "awaiting_files"
    ),
    categoriesConfirmedAt:
      typeof googleExport.categoriesConfirmedAt === "string"
        ? googleExport.categoriesConfirmedAt
        : null,
    exportRequestedAt:
      typeof googleExport.exportRequestedAt === "string" ? googleExport.exportRequestedAt : null,
    awaitingArchiveAt:
      typeof googleExport.awaitingArchiveAt === "string" ? googleExport.awaitingArchiveAt : null,
    requestedCategories: parseSelectedCategories(googleExport.requestedCategories),
    waitingStartedAt,
    lastCheckedAt:
      typeof googleExport.lastCheckedAt === "string" ? googleExport.lastCheckedAt : null,
    detectedAt: typeof googleExport.detectedAt === "string" ? googleExport.detectedAt : null,
    detectedItemCount:
      typeof googleExport.detectedItemCount === "number" ? googleExport.detectedItemCount : null,
    detectedCategories: parseSelectedCategories(googleExport.detectedCategories),
    autoInventoryStartedAt:
      typeof googleExport.autoInventoryStartedAt === "string"
        ? googleExport.autoInventoryStartedAt
        : null,
    inventoryCompletedAt:
      typeof googleExport.inventoryCompletedAt === "string"
        ? googleExport.inventoryCompletedAt
        : null
  };
}

function withGoogleAuthSessionCursor(
  inventoryCursor: Record<string, unknown>,
  session: GoogleConnectorAuthSession,
  authState: Extract<ConnectorAuthState, "awaiting_user" | "authenticated" | "reauth_required">
): Record<string, unknown> {
  return {
    ...inventoryCursor,
    googleAuth: {
      authState,
      sessionId: session.sessionId,
      status: session.status,
      loginMode: session.loginMode,
      continueUrl: session.continueUrl,
      launchUrl: session.launchUrl,
      requestedCategories: session.requestedCategories,
      preparedAt: session.preparedAt,
      authenticatedAt: session.authenticatedAt
    }
  };
}

function withGoogleExportSessionCursor(
  inventoryCursor: Record<string, unknown>,
  session: GoogleConnectorExportSession,
  exportState: Extract<
    ConnectorExportState,
    "awaiting_files" | "files_detected" | "inventory_started" | "inventory_completed"
  >
): Record<string, unknown> {
  return {
    ...inventoryCursor,
    googleExport: {
      exportState,
      sessionId: session.sessionId,
      status: session.status,
      exportRootPath: session.exportRootPath,
      handoffUrl: session.handoffUrl,
      archiveExpectation: session.archiveExpectation,
      orchestrationSteps: session.orchestrationSteps,
      watchFolderReadyAt: session.watchFolderReadyAt,
      guideState: session.guideState,
      categoriesConfirmedAt: session.categoriesConfirmedAt,
      exportRequestedAt: session.exportRequestedAt,
      awaitingArchiveAt: session.awaitingArchiveAt,
      requestedCategories: session.requestedCategories,
      waitingStartedAt: session.waitingStartedAt,
      lastCheckedAt: session.lastCheckedAt,
      detectedAt: session.detectedAt,
      detectedItemCount: session.detectedItemCount,
      detectedCategories: session.detectedCategories,
      autoInventoryStartedAt: session.autoInventoryStartedAt,
      inventoryCompletedAt: session.inventoryCompletedAt
    }
  };
}

function defaultExtractionStrategy(input: RegisterConnectorInput): Connector["extractionStrategy"] {
  if (input.platform === "local_hardware") {
    return "local";
  }

  return input.surface === "browser_account" ? "browser" : "export";
}

function laneForCategory(category: Category): "recent_import" | "location_history" {
  return category === "geolocation" ? "location_history" : "recent_import";
}

function generateStoragePath(workspaceId: string, category: Category, contentHash: string): string {
  return `anchors/${workspaceId}/${category}/${contentHash}`;
}

function ensureCategorySelection(categories: Category[]): void {
  if (categories.length === 0) {
    throw new ControlPlaneInputError("At least one category must be selected.");
  }
}

function deriveFitState(
  netNewBytesEstimate: number,
  availableAnchiseBytes: number | null
): ImportPlan["fitState"] {
  if (availableAnchiseBytes === null) {
    return "unknown";
  }

  if (netNewBytesEstimate <= availableAnchiseBytes) {
    return "fits";
  }

  return netNewBytesEstimate <= availableAnchiseBytes * 1.15 ? "likely_exceeds" : "exceeds";
}

function ensurePositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ControlPlaneInputError(`${fieldName} must be a positive integer.`);
  }
}

function isPostgresError(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    workspaceId: row.id,
    ownerId: row.owner_id,
    planState: row.plan_state,
    agentState: row.agent_state,
    storageCapacityBytes: toRequiredNumber(row.storage_capacity_bytes, "storage_capacity_bytes"),
    storageUsedBytes: toRequiredNumber(row.storage_used_bytes, "storage_used_bytes"),
    createdAt: toIso(row.created_at) ?? new Date().toISOString()
  };
}

function mapConnector(row: ConnectorRow): Connector {
  const inventoryCursor = toJsonObject(row.inventory_cursor);

  return {
    connectorId: row.id,
    workspaceId: row.workspace_id,
    platform: row.platform,
    accountLabel: row.account_label,
    surface: row.surface,
    state: row.state,
    extractionStrategy: row.extraction_strategy,
    deleteCapability: row.delete_capability,
    authState: parseConnectorAuthState(row.platform, inventoryCursor),
    authSession: row.platform === "google" ? mapGoogleAuthSession(row.id, inventoryCursor) : null,
    exportState: parseConnectorExportState(row.platform, inventoryCursor),
    exportSession: row.platform === "google" ? mapGoogleExportSession(row.id, inventoryCursor) : null,
    settings: toJsonObject(row.settings) as ConnectorSettings,
    inventoryCursor,
    lastInventoryAt: toIso(row.last_inventory_at),
    lastError: row.last_error
  };
}

function mapCategory(row: InventoryCategoryRow) {
  const bytesEstimate = toNumber(row.bytes_estimate);
  const duplicateBytesEstimate = toNumber(row.duplicate_bytes_estimate);

  return {
    category: row.category,
    itemCountEstimate: toNumber(row.item_count_estimate),
    bytesEstimate,
    duplicateBytesEstimate,
    netNewBytesEstimate:
      bytesEstimate === null
        ? null
        : Math.max(bytesEstimate - (duplicateBytesEstimate ?? 0), 0),
    importSupported: row.import_supported,
    incrementalSupported: row.incremental_supported,
    dateRangeStart: toIso(row.date_range_start),
    dateRangeEnd: toIso(row.date_range_end)
  };
}

function mapInventorySnapshot(
  row: InventorySnapshotRow,
  categoryRows: InventoryCategoryRow[]
): InventorySnapshot {
  return {
    inventoryId: row.id,
    connectorId: row.connector_id,
    status: row.status,
    categories: categoryRows.map(mapCategory),
    comparison: {
      sourceBytesEstimate: toNumber(row.source_bytes_estimate),
      netNewBytesEstimate: toNumber(row.net_new_bytes_estimate),
      existingAnchiseBytesEstimate: toNumber(row.existing_anchise_bytes_estimate),
      availableAnchiseBytes: toNumber(row.available_anchise_bytes),
      fitState: row.fit_state
    },
    generatedAt: toIso(row.generated_at) ?? new Date().toISOString()
  };
}

function mapImportPlan(row: ImportPlanRow): ImportPlan {
  return {
    planId: row.id,
    workspaceId: row.workspace_id,
    connectorId: row.connector_id,
    snapshotId: row.snapshot_id,
    categories: parseSelectedCategories(row.selected_categories),
    mode: row.mode,
    sourceAction: row.source_action,
    sourceBytesEstimate: toNumber(row.source_bytes_estimate),
    netNewBytesEstimate: toNumber(row.net_new_bytes_estimate),
    availableAnchiseBytes: toNumber(row.available_anchise_bytes),
    fitState: row.fit_state,
    status: row.status,
    requestedAt: toIso(row.requested_at) ?? new Date().toISOString(),
    confirmedAt: toIso(row.confirmed_at)
  };
}

function mapSourceItem(row: SourceItemRow): SourceItem {
  return {
    sourceItemId: row.id,
    connectorId: row.connector_id,
    snapshotId: row.snapshot_id,
    category: row.category,
    externalItemId: row.source_item_id,
    sourcePath: row.source_path,
    externalUpdatedAt: toIso(row.external_updated_at),
    byteSizeEstimate: toNumber(row.byte_size_estimate),
    contentHashHint: row.content_hash_hint,
    mimeType: row.mime_type,
    title: row.title,
    inventoryState: row.inventory_state,
    downloadDisposition: row.download_disposition,
    importedObjectId: row.imported_object_id,
    metadata: toJsonObject(row.metadata)
  };
}

function mapImportBatch(row: ImportBatchRow): ImportBatch {
  return {
    batchId: row.id,
    planId: row.plan_id,
    connectorId: row.connector_id,
    ordinal: row.ordinal,
    status: row.status,
    itemsExpected: toRequiredNumber(row.items_expected, "items_expected"),
    itemsReceived: toRequiredNumber(row.items_received, "items_received"),
    bytesPlanned: toRequiredNumber(row.bytes_planned, "bytes_planned"),
    bytesDownloaded: toRequiredNumber(row.bytes_downloaded, "bytes_downloaded"),
    bytesUploaded: toRequiredNumber(row.bytes_uploaded, "bytes_uploaded"),
    dedupHits: toRequiredNumber(row.dedup_hits, "dedup_hits"),
    dedupBytesSkipped: toRequiredNumber(row.dedup_bytes_skipped, "dedup_bytes_skipped"),
    startedAt: toIso(row.started_at) ?? new Date().toISOString(),
    completedAt: toIso(row.completed_at),
    error: row.error
  };
}

function mapObjectManifest(row: ObjectManifestRow): ObjectManifest {
  return {
    manifestId: row.id,
    workspaceId: row.workspace_id,
    connectorId: row.connector_id,
    batchId: row.batch_id,
    category: row.category,
    objectCount: toRequiredNumber(row.object_count, "object_count"),
    chunkCount: toRequiredNumber(row.chunk_count, "chunk_count"),
    bytesPlainEstimate: toRequiredNumber(row.bytes_plain_estimate, "bytes_plain_estimate"),
    bytesStored: toRequiredNumber(row.bytes_stored, "bytes_stored"),
    bytesSkippedDedup: toRequiredNumber(row.bytes_skipped_dedup, "bytes_skipped_dedup"),
    integrityState: row.integrity_state,
    verificationAt: toIso(row.verification_at),
    error: row.error,
    createdAt: toIso(row.created_at) ?? new Date().toISOString()
  };
}

async function runInTransaction<T>(
  db: Sql<Record<string, unknown>>,
  work: (tx: Sql<Record<string, unknown>>) => Promise<T>
): Promise<T> {
  const maybeTransactional = db as Sql<Record<string, unknown>> & {
    begin?: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };

  if (typeof maybeTransactional.begin === "function") {
    return (await maybeTransactional.begin((tx) =>
      work(tx as unknown as Sql<Record<string, unknown>>)
    )) as T;
  }

  return work(db);
}

export class ControlPlaneInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlPlaneInputError";
  }
}

async function listInventoryCategories(
  tx: Sql<Record<string, unknown>>,
  snapshotId: string
): Promise<InventoryCategoryRow[]> {
  return tx<InventoryCategoryRow[]>`
    select
      snapshot_id,
      category,
      item_count_estimate,
      bytes_estimate,
      duplicate_bytes_estimate,
      import_supported,
      incremental_supported,
      date_range_start,
      date_range_end
    from inventory_categories
    where snapshot_id = ${snapshotId}
    order by category asc
  `;
}

async function listSourceItemsForSnapshot(
  tx: Sql<Record<string, unknown>>,
  snapshotId: string
): Promise<SourceItem[]> {
  const rows = await tx<SourceItemRow[]>`
    select
      id,
      connector_id,
      snapshot_id,
      category,
      source_item_id,
      source_path,
      external_updated_at,
      byte_size_estimate,
      content_hash_hint,
      mime_type,
      title,
      inventory_state,
      download_disposition,
      imported_object_id,
      metadata
    from source_items
    where snapshot_id = ${snapshotId}
    order by category asc, external_updated_at desc nulls last, id asc
  `;

  return rows.map(mapSourceItem);
}

async function listManifestsForBatch(
  tx: Sql<Record<string, unknown>>,
  batchId: string
): Promise<ObjectManifest[]> {
  const rows = await tx<ObjectManifestRow[]>`
    select
      id,
      workspace_id,
      connector_id,
      batch_id,
      category,
      object_count,
      chunk_count,
      bytes_plain_estimate,
      bytes_stored,
      bytes_skipped_dedup,
      integrity_state,
      verification_at,
      error,
      created_at
    from object_manifests
    where batch_id = ${batchId}
    order by category asc
  `;

  return rows.map(mapObjectManifest);
}

async function listSourceItemsForBatch(
  tx: Sql<Record<string, unknown>>,
  batchId: string
): Promise<SourceItem[]> {
  const rows = await tx<BatchSourceItemJoinRow[]>`
    select
      si.id,
      si.connector_id,
      si.snapshot_id,
      si.category,
      si.source_item_id,
      si.source_path,
      si.external_updated_at,
      si.byte_size_estimate,
      si.content_hash_hint,
      si.mime_type,
      si.title,
      si.inventory_state,
      si.download_disposition,
      si.imported_object_id,
      si.metadata,
      bsi.batch_id,
      bsi.ordinal as batch_ordinal,
      bsi.status as batch_status,
      bsi.planned_byte_size
    from batch_source_items bsi
    join source_items si on si.id = bsi.source_item_id
    where bsi.batch_id = ${batchId}
    order by bsi.ordinal asc
  `;

  return rows.map(mapSourceItem);
}

async function applyConnectorStateChange(
  tx: Sql<Record<string, unknown>>,
  input: ConnectorStateChange
): Promise<void> {
  const [current] = await tx<{ state: Connector["state"] | null }[]>`
    select state
    from connectors
    where id = ${input.connectorId}
  `;

  if (!current) {
    throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
  }

  await tx`
    update connectors
    set
      state = ${input.toState},
      last_error = ${input.lastError ?? null},
      last_inventory_at = coalesce(${input.lastInventoryAt ?? null}, last_inventory_at),
      updated_at = now()
    where id = ${input.connectorId}
  `;

  await tx`
    insert into connector_events (
      connector_id,
      from_state,
      to_state,
      trigger,
      details
    )
    values (
      ${input.connectorId},
      ${current.state},
      ${input.toState},
      ${input.trigger},
      ${JSON.stringify(input.details ?? {})}::jsonb
    )
  `;
}

async function createInventorySnapshotTx(
  tx: Sql<Record<string, unknown>>,
  input: RecordInventorySnapshotInput
): Promise<InventorySnapshot> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const [connector] = await tx<{ id: string }[]>`
    select id
    from connectors
    where id = ${input.connectorId}
  `;

  if (!connector) {
    throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
  }

  await tx`
    update inventory_snapshots
    set status = 'superseded', superseded_at = now()
    where connector_id = ${input.connectorId}
      and status = 'ready'
  `;

  const [snapshotRow] = await tx<InventorySnapshotRow[]>`
    insert into inventory_snapshots (
      connector_id,
      status,
      source_bytes_estimate,
      net_new_bytes_estimate,
      existing_anchise_bytes_estimate,
      available_anchise_bytes,
      fit_state,
      space_warning,
      generated_at
    )
    values (
      ${input.connectorId},
      'ready',
      ${input.comparison.sourceBytesEstimate},
      ${input.comparison.netNewBytesEstimate},
      ${input.comparison.existingAnchiseBytesEstimate ?? 0},
      ${input.comparison.availableAnchiseBytes},
      ${input.comparison.fitState},
      ${input.comparison.fitState !== "fits"},
      ${generatedAt}
    )
    returning
      id,
      connector_id,
      status,
      source_bytes_estimate,
      net_new_bytes_estimate,
      existing_anchise_bytes_estimate,
      available_anchise_bytes,
      fit_state,
      generated_at
  `;

  for (const category of input.categories) {
    await tx`
      insert into inventory_categories (
        snapshot_id,
        category,
        item_count_estimate,
        bytes_estimate,
        duplicate_bytes_estimate,
        import_supported,
        incremental_supported,
        date_range_start,
        date_range_end
      )
      values (
        ${snapshotRow.id},
        ${category.category},
        ${category.itemCountEstimate},
        ${category.bytesEstimate},
        ${category.duplicateBytesEstimate ?? 0},
        ${category.importSupported},
        ${category.incrementalSupported},
        ${category.dateRangeStart},
        ${category.dateRangeEnd}
      )
    `;
  }

  const categoryRows = await listInventoryCategories(tx, snapshotRow.id);
  return mapInventorySnapshot(snapshotRow, categoryRows);
}

async function upsertSourceItemsTx(
  tx: Sql<Record<string, unknown>>,
  snapshotId: string,
  connectorId: string,
  sourceItems: DiscoveredSourceItemInput[]
): Promise<SourceItem[]> {
  for (const item of sourceItems) {
    await tx`
      insert into source_items (
        connector_id,
        snapshot_id,
        category,
        source_item_id,
        source_path,
        external_updated_at,
        byte_size_estimate,
        content_hash_hint,
        mime_type,
        title,
        metadata
      )
      values (
        ${connectorId},
        ${snapshotId},
        ${item.category},
        ${item.externalItemId},
        ${item.sourcePath ?? null},
        ${item.externalUpdatedAt ?? null},
        ${item.byteSizeEstimate ?? null},
        ${item.contentHashHint ?? null},
        ${item.mimeType ?? null},
        ${item.title ?? null},
        ${JSON.stringify(item.metadata ?? {})}::jsonb
      )
      on conflict (connector_id, source_item_id)
      do update set
        snapshot_id = excluded.snapshot_id,
        category = excluded.category,
        source_path = excluded.source_path,
        external_updated_at = excluded.external_updated_at,
        byte_size_estimate = excluded.byte_size_estimate,
        content_hash_hint = excluded.content_hash_hint,
        mime_type = excluded.mime_type,
        title = excluded.title,
        metadata = excluded.metadata,
        last_seen_at = now(),
        updated_at = now(),
        inventory_state = case
          when source_items.imported_object_id is not null then source_items.inventory_state
          else 'discovered'
        end,
        download_disposition = case
          when source_items.imported_object_id is not null then source_items.download_disposition
          else 'defer'
        end
    `;
  }

  return listSourceItemsForSnapshot(tx, snapshotId);
}

export interface ControlPlaneRepository {
  schemaName: string;
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  getConnector(connectorId: string): Promise<Connector | null>;
  registerConnector(input: RegisterConnectorInput): Promise<Connector>;
  listConnectors(workspaceId: string): Promise<Connector[]>;
  setConnectorState(input: ConnectorStateChange): Promise<Connector>;
  recordInventorySnapshot(input: RecordInventorySnapshotInput): Promise<InventorySnapshot>;
  captureInventory(input: InventoryCaptureInput): Promise<{
    snapshot: InventorySnapshot;
    sourceItems: SourceItem[];
  }>;
  persistGoogleAuthSession(input: PersistGoogleAuthSessionInput): Promise<Connector>;
  persistGoogleExportSession(input: PersistGoogleExportSessionInput): Promise<Connector>;
  completeGoogleAuthSession(input: CompleteGoogleAuthSessionInput): Promise<Connector>;
  draftImportPlan(input: DraftImportPlanInput): Promise<ImportPlan>;
  confirmImportPlan(planId: string): Promise<ImportPlan>;
  materializeImportBatch(input: MaterializeImportBatchInput): Promise<MaterializedImportBatch>;
  commitImportBatch(input: CommitImportBatchInput): Promise<CommittedImportBatch>;
}

export function createControlPlaneRepository(
  db: Sql<Record<string, unknown>> = getDb()
): ControlPlaneRepository {
  return {
    schemaName: getDbSchemaName(),

    async createWorkspace(input) {
      if (input.storageCapacityBytes <= 0) {
        throw new ControlPlaneInputError("storageCapacityBytes must be greater than zero.");
      }

      const [row] = await db<WorkspaceRow[]>`
        insert into workspaces (
          owner_id,
          plan_state,
          agent_state,
          storage_capacity_bytes
        )
        values (
          ${input.ownerId},
          ${input.planState ?? "trial"},
          ${input.agentState ?? "not_installed"},
          ${input.storageCapacityBytes}
        )
        returning id, owner_id, plan_state, agent_state, storage_capacity_bytes, storage_used_bytes, created_at
      `;

      return mapWorkspace(row);
    },

    async getWorkspace(workspaceId) {
      const [row] = await db<WorkspaceRow[]>`
        select id, owner_id, plan_state, agent_state, storage_capacity_bytes, storage_used_bytes, created_at
        from workspaces
        where id = ${workspaceId}
      `;

      return row ? mapWorkspace(row) : null;
    },

    async getConnector(connectorId) {
      const [row] = await db<ConnectorRow[]>`
        select
          id,
          workspace_id,
          platform,
          account_label,
          surface,
          state,
          extraction_strategy,
          delete_capability,
          settings,
          inventory_cursor,
          last_inventory_at,
          last_error
        from connectors
        where id = ${connectorId}
      `;

      return row ? mapConnector(row) : null;
    },

    async registerConnector(input) {
      const [workspace] = await db<{ id: string }[]>`
        select id
        from workspaces
        where id = ${input.workspaceId}
      `;

      if (!workspace) {
        throw new ControlPlaneInputError(`Workspace ${input.workspaceId} does not exist.`);
      }

      try {
        return await runInTransaction(db, async (tx) => {
          const [row] = await tx<ConnectorRow[]>`
            insert into connectors (
              workspace_id,
              platform,
              account_label,
              surface,
              state,
              extraction_strategy,
              delete_capability,
              settings,
              inventory_cursor
            )
            values (
              ${input.workspaceId},
              ${input.platform},
              ${input.accountLabel},
              ${input.surface},
              'connected',
              ${input.extractionStrategy ?? defaultExtractionStrategy(input)},
              ${input.deleteCapability ?? "download_only"},
              ${JSON.stringify(input.settings ?? {})}::jsonb,
              ${
                JSON.stringify(
                  input.platform === "google"
                    ? {
                        googleAuth: {
                          authState: defaultAuthState(input.platform)
                        },
                        googleExport: {
                          exportState: defaultExportState(input.platform)
                        }
                      }
                    : {}
                )
              }::jsonb
            )
            returning
              id,
              workspace_id,
              platform,
              account_label,
              surface,
              state,
              extraction_strategy,
              delete_capability,
              settings,
              inventory_cursor,
              last_inventory_at,
              last_error
          `;

          await tx`
            insert into connector_events (
              connector_id,
              from_state,
              to_state,
              trigger,
              details
            )
            values (
              ${row.id},
              null,
              'connected',
              'connector_registered',
              ${JSON.stringify({
                platform: input.platform,
                surface: input.surface
              })}::jsonb
            )
          `;

          return mapConnector(row);
        });
      } catch (error) {
        if (isPostgresError(error) && error.code === "23505") {
          throw new ControlPlaneInputError(
            `Connector ${input.accountLabel} is already registered for this workspace and platform.`
          );
        }

        throw error;
      }
    },

    async listConnectors(workspaceId) {
      const rows = await db<ConnectorRow[]>`
        select
          id,
          workspace_id,
          platform,
          account_label,
          surface,
          state,
          extraction_strategy,
          delete_capability,
          settings,
          inventory_cursor,
          last_inventory_at,
          last_error
        from connectors
        where workspace_id = ${workspaceId}
        order by created_at asc
      `;

      return rows.map(mapConnector);
    },

    async setConnectorState(input) {
      return runInTransaction(db, async (tx) => {
        await applyConnectorStateChange(tx, input);
        const [row] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        return mapConnector(row);
      });
    },

    async recordInventorySnapshot(input) {
      return runInTransaction(db, async (tx) => {
        const snapshot = await createInventorySnapshotTx(tx, input);

        await applyConnectorStateChange(tx, {
          connectorId: input.connectorId,
          toState: "inventory_ready",
          trigger: "inventory_snapshot_recorded",
          details: {
            fitState: input.comparison.fitState,
            categoryCount: input.categories.length
          },
          lastInventoryAt: snapshot.generatedAt,
          lastError: null
        });

        return snapshot;
      });
    },

    async captureInventory(input) {
      return runInTransaction(db, async (tx) => {
        const snapshot = await createInventorySnapshotTx(tx, input);
        const sourceItems = await upsertSourceItemsTx(tx, snapshot.inventoryId, input.connectorId, input.sourceItems);

        await applyConnectorStateChange(tx, {
          connectorId: input.connectorId,
          toState: "inventory_ready",
          trigger: "inventory_captured",
          details: {
            fitState: input.comparison.fitState,
            categoryCount: input.categories.length,
            discoveredItemCount: sourceItems.length
          },
          lastInventoryAt: snapshot.generatedAt,
          lastError: null
        });

        return { snapshot, sourceItems };
      });
    },

    async persistGoogleAuthSession(input) {
      return runInTransaction(db, async (tx) => {
        const [existingRow] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        if (!existingRow) {
          throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
        }

        if (existingRow.platform !== "google") {
          throw new ControlPlaneInputError("Google auth can only be prepared for Google connectors.");
        }

        const updatedCursor = withGoogleAuthSessionCursor(
          toJsonObject(existingRow.inventory_cursor),
          input.session,
          "awaiting_user"
        );

        await tx`
          update connectors
          set inventory_cursor = ${JSON.stringify(updatedCursor)}::jsonb, last_error = null
          where id = ${input.connectorId}
        `;

        await applyConnectorStateChange(tx, {
          connectorId: input.connectorId,
          toState: "action_needed",
          trigger: "google_auth_prepared",
          details: {
            sessionId: input.session.sessionId
          },
          lastError: null
        });

        const [updatedRow] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        return mapConnector(updatedRow);
      });
    },

    async persistGoogleExportSession(input) {
      return runInTransaction(db, async (tx) => {
        const [existingRow] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        if (!existingRow) {
          throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
        }

        if (existingRow.platform !== "google") {
          throw new ControlPlaneInputError(
            "Google export state can only be persisted for Google connectors."
          );
        }

        const updatedCursor = withGoogleExportSessionCursor(
          toJsonObject(existingRow.inventory_cursor),
          input.session,
          input.exportState
        );

        await tx`
          update connectors
          set inventory_cursor = ${JSON.stringify(updatedCursor)}::jsonb, last_error = null
          where id = ${input.connectorId}
        `;

        const [updatedRow] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        return mapConnector(updatedRow);
      });
    },

    async completeGoogleAuthSession(input) {
      return runInTransaction(db, async (tx) => {
        const [existingRow] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        if (!existingRow) {
          throw new ControlPlaneInputError(`Connector ${input.connectorId} does not exist.`);
        }

        if (existingRow.platform !== "google") {
          throw new ControlPlaneInputError("Google auth can only be completed for Google connectors.");
        }

        const inventoryCursor = toJsonObject(existingRow.inventory_cursor);
        const existingSession = mapGoogleAuthSession(input.connectorId, inventoryCursor);

        if (!existingSession || existingSession.sessionId !== input.sessionId) {
          throw new ControlPlaneInputError(
            "The prepared Google auth session does not match this connector."
          );
        }

        const completedSession: GoogleConnectorAuthSession = {
          ...existingSession,
          status: "authenticated",
          authenticatedAt: new Date().toISOString()
        };

        const updatedCursor = withGoogleAuthSessionCursor(
          inventoryCursor,
          completedSession,
          "authenticated"
        );

        const settings = toJsonObject(existingRow.settings) as ConnectorSettings;
        const exportRootPath =
          typeof settings.rootPath === "string" && settings.rootPath.trim() !== ""
            ? settings.rootPath
            : null;
        const requestedCategories =
          completedSession.requestedCategories.length > 0
            ? completedSession.requestedCategories
            : parseSelectedCategories(
                toJsonObject(updatedCursor.googleExport).requestedCategories
              );

        const finalCursor =
          exportRootPath === null
            ? updatedCursor
            : withGoogleExportSessionCursor(
                updatedCursor,
                {
                  sessionId:
                    typeof toJsonObject(inventoryCursor.googleExport).sessionId === "string"
                      ? String(toJsonObject(inventoryCursor.googleExport).sessionId)
                      : randomUUID(),
                  connectorId: input.connectorId,
                  status: "awaiting_files",
                  exportRootPath,
                  handoffUrl: null,
                  archiveExpectation: null,
                  orchestrationSteps: [],
                  watchFolderReadyAt: null,
                  guideState: "handoff_ready",
                  categoriesConfirmedAt: null,
                  exportRequestedAt: null,
                  awaitingArchiveAt: null,
                  requestedCategories,
                  waitingStartedAt: new Date().toISOString(),
                  lastCheckedAt: null,
                  detectedAt: null,
                  detectedItemCount: null,
                  detectedCategories: [],
                  autoInventoryStartedAt: null,
                  inventoryCompletedAt: null
                },
                "awaiting_files"
              );

        await tx`
          update connectors
          set inventory_cursor = ${JSON.stringify(finalCursor)}::jsonb, last_error = null
          where id = ${input.connectorId}
        `;

        await applyConnectorStateChange(tx, {
          connectorId: input.connectorId,
          toState: "connected",
          trigger: "google_auth_completed",
          details: {
            sessionId: input.sessionId
          },
          lastError: null
        });

        const [updatedRow] = await tx<ConnectorRow[]>`
          select
            id,
            workspace_id,
            platform,
            account_label,
            surface,
            state,
            extraction_strategy,
            delete_capability,
            settings,
            inventory_cursor,
            last_inventory_at,
            last_error
          from connectors
          where id = ${input.connectorId}
        `;

        return mapConnector(updatedRow);
      });
    },

    async draftImportPlan(input) {
      ensureCategorySelection(input.categories);

      return runInTransaction(db, async (tx) => {
        const [snapshot] = await tx<(InventorySnapshotRow & { workspace_id: string })[]>`
          select
            s.id,
            s.connector_id,
            s.status,
            s.source_bytes_estimate,
            s.net_new_bytes_estimate,
            s.existing_anchise_bytes_estimate,
            s.available_anchise_bytes,
            s.fit_state,
            s.generated_at,
            c.workspace_id
          from inventory_snapshots s
          join connectors c on c.id = s.connector_id
          where s.id = ${input.snapshotId}
        `;

        if (!snapshot) {
          throw new ControlPlaneInputError(`Inventory snapshot ${input.snapshotId} does not exist.`);
        }

        if (snapshot.connector_id !== input.connectorId) {
          throw new ControlPlaneInputError("Snapshot does not belong to the selected connector.");
        }

        if (snapshot.workspace_id !== input.workspaceId) {
          throw new ControlPlaneInputError("Snapshot does not belong to the selected workspace.");
        }

        if (snapshot.status !== "ready") {
          throw new ControlPlaneInputError("Only ready snapshots can become import plans.");
        }

        const categoryRows = await listInventoryCategories(tx, input.snapshotId);
        const categoryByName = new Map(categoryRows.map((row) => [row.category, row]));

        for (const category of input.categories) {
          const categoryRow = categoryByName.get(category);

          if (!categoryRow) {
            throw new ControlPlaneInputError(`Category ${category} is not present in the selected snapshot.`);
          }

          if (!categoryRow.import_supported) {
            throw new ControlPlaneInputError(`Category ${category} is not currently importable.`);
          }
        }

        const sourceBytesEstimate = input.categories.reduce((total, category) => {
          const categoryRow = categoryByName.get(category);
          return total + (toNumber(categoryRow ? categoryRow.bytes_estimate : null) ?? 0);
        }, 0);

        const netNewBytesEstimate = input.categories.reduce((total, category) => {
          const categoryRow = categoryByName.get(category);
          const categoryBytes = toNumber(categoryRow ? categoryRow.bytes_estimate : null) ?? 0;
          const duplicateBytes = toNumber(categoryRow ? categoryRow.duplicate_bytes_estimate : null) ?? 0;
          return total + Math.max(categoryBytes - duplicateBytes, 0);
        }, 0);

        const availableAnchiseBytes = toNumber(snapshot.available_anchise_bytes);
        const fitState = deriveFitState(netNewBytesEstimate, availableAnchiseBytes);

        const [planRow] = await tx<ImportPlanRow[]>`
          insert into import_plans (
            workspace_id,
            connector_id,
            snapshot_id,
            mode,
            source_action,
            selected_categories,
            source_bytes_estimate,
            net_new_bytes_estimate,
            available_anchise_bytes,
            fit_state,
            status
          )
          values (
            ${input.workspaceId},
            ${input.connectorId},
            ${input.snapshotId},
            ${input.mode ?? "incremental"},
            ${input.sourceAction},
            ${JSON.stringify(input.categories)}::jsonb,
            ${sourceBytesEstimate},
            ${netNewBytesEstimate},
            ${availableAnchiseBytes},
            ${fitState},
            'draft'
          )
          returning
            id,
            workspace_id,
            connector_id,
            snapshot_id,
            selected_categories,
            mode,
            source_action,
            source_bytes_estimate,
            net_new_bytes_estimate,
            available_anchise_bytes,
            fit_state,
            status,
            requested_at,
            confirmed_at
        `;

        return mapImportPlan(planRow);
      });
    },

    async confirmImportPlan(planId) {
      return runInTransaction(db, async (tx) => {
        const [existingPlan] = await tx<ImportPlanRow[]>`
          select
            id,
            workspace_id,
            connector_id,
            snapshot_id,
            selected_categories,
            mode,
            source_action,
            source_bytes_estimate,
            net_new_bytes_estimate,
            available_anchise_bytes,
            fit_state,
            status,
            requested_at,
            confirmed_at
          from import_plans
          where id = ${planId}
        `;

        if (!existingPlan) {
          throw new ControlPlaneInputError(`Import plan ${planId} does not exist.`);
        }

        if (existingPlan.status !== "draft") {
          throw new ControlPlaneInputError("Only draft plans can be confirmed.");
        }

        if (existingPlan.fit_state === "exceeds") {
          throw new ControlPlaneInputError(
            "This plan exceeds the Anchise space available right now. Reduce the selection before confirming."
          );
        }

        const [planRow] = await tx<ImportPlanRow[]>`
          update import_plans
          set status = 'confirmed', confirmed_at = now()
          where id = ${planId}
          returning
            id,
            workspace_id,
            connector_id,
            snapshot_id,
            selected_categories,
            mode,
            source_action,
            source_bytes_estimate,
            net_new_bytes_estimate,
            available_anchise_bytes,
            fit_state,
            status,
            requested_at,
            confirmed_at
        `;

        await applyConnectorStateChange(tx, {
          connectorId: planRow.connector_id,
          toState: "download_pending",
          trigger: "import_plan_confirmed",
          details: {
            planId: planRow.id,
            fitState: planRow.fit_state
          }
        });

        return mapImportPlan(planRow);
      });
    },

    async materializeImportBatch(input) {
      const batchSize = input.batchSize ?? 12;
      ensurePositiveInteger(batchSize, "batchSize");

      return runInTransaction(db, async (tx) => {
        const [planRow] = await tx<ImportPlanRow[]>`
          select
            id,
            workspace_id,
            connector_id,
            snapshot_id,
            selected_categories,
            mode,
            source_action,
            fit_state,
            status,
            requested_at,
            confirmed_at
          from import_plans
          where id = ${input.planId}
        `;

        if (!planRow) {
          throw new ControlPlaneInputError(`Import plan ${input.planId} does not exist.`);
        }

        if (!["confirmed", "running"].includes(planRow.status)) {
          throw new ControlPlaneInputError("Only confirmed or running plans can materialize batches.");
        }

        const categories = parseSelectedCategories(planRow.selected_categories);
        const sourceRows = await tx<SourceItemRow[]>`
          select
            id,
            connector_id,
            snapshot_id,
            category,
            source_item_id,
            source_path,
            external_updated_at,
            byte_size_estimate,
            content_hash_hint,
            mime_type,
            title,
            inventory_state,
            download_disposition,
            imported_object_id,
            metadata
          from source_items
          where connector_id = ${planRow.connector_id}
            and imported_object_id is null
            and download_disposition = 'defer'
          order by external_updated_at desc nulls last, first_seen_at asc, id asc
        `;

        const eligibleRows = sourceRows
          .filter((row) => categories.includes(row.category))
          .slice(0, batchSize);

        if (eligibleRows.length === 0) {
          throw new ControlPlaneInputError(
            "No incremental source items remain for this plan. Run inventory again or change the plan selection."
          );
        }

        const [ordinalRow] = await tx<{ next_ordinal: NumericLike }[]>`
          select coalesce(max(ordinal), 0) + 1 as next_ordinal
          from import_batches
          where plan_id = ${planRow.id}
        `;

        const bytesPlanned = eligibleRows.reduce(
          (total, row) => total + (toNumber(row.byte_size_estimate) ?? 0),
          0
        );

        const [batchRow] = await tx<ImportBatchRow[]>`
          insert into import_batches (
            plan_id,
            connector_id,
            ordinal,
            status,
            items_expected,
            bytes_planned
          )
          values (
            ${planRow.id},
            ${planRow.connector_id},
            ${toRequiredNumber(ordinalRow.next_ordinal, "next_ordinal")},
            'queued',
            ${eligibleRows.length},
            ${bytesPlanned}
          )
          returning
            id,
            plan_id,
            connector_id,
            ordinal,
            status,
            items_expected,
            items_received,
            bytes_planned,
            bytes_downloaded,
            bytes_uploaded,
            dedup_hits,
            dedup_bytes_skipped,
            started_at,
            completed_at,
            error
        `;

        const grouped = new Map<Category, { count: number; bytes: number }>();
        eligibleRows.forEach((row) => {
          const current = grouped.get(row.category) ?? { count: 0, bytes: 0 };
          current.count += 1;
          current.bytes += toNumber(row.byte_size_estimate) ?? 0;
          grouped.set(row.category, current);
        });

        for (const [index, row] of eligibleRows.entries()) {
          await tx`
            insert into batch_source_items (
              batch_id,
              source_item_id,
              ordinal,
              status,
              planned_byte_size
            )
            values (
              ${batchRow.id},
              ${row.id},
              ${index + 1},
              'planned',
              ${toNumber(row.byte_size_estimate) ?? 0}
            )
          `;

          await tx`
            update source_items
            set
              inventory_state = 'planned',
              download_disposition = 'pending',
              last_planned_at = now(),
              updated_at = now()
            where id = ${row.id}
          `;
        }

        for (const [category, summary] of grouped.entries()) {
          await tx`
            insert into object_manifests (
              workspace_id,
              connector_id,
              batch_id,
              category,
              object_count,
              chunk_count,
              bytes_plain_estimate
            )
            values (
              ${planRow.workspace_id},
              ${planRow.connector_id},
              ${batchRow.id},
              ${category},
              ${summary.count},
              ${summary.count},
              ${summary.bytes}
            )
          `;
        }

        await tx`
          update import_plans
          set status = 'running'
          where id = ${planRow.id}
        `;

        await applyConnectorStateChange(tx, {
          connectorId: planRow.connector_id,
          toState: "downloading",
          trigger: "import_batch_materialized",
          details: {
            planId: planRow.id,
            batchId: batchRow.id,
            itemsExpected: eligibleRows.length
          }
        });

        return {
          batch: mapImportBatch(batchRow),
          manifests: await listManifestsForBatch(tx, batchRow.id),
          sourceItems: await listSourceItemsForBatch(tx, batchRow.id)
        };
      });
    },

    async commitImportBatch(input) {
      if (input.objects.length === 0) {
        throw new ControlPlaneInputError("At least one committed object is required.");
      }

      return runInTransaction(db, async (tx) => {
        const [context] = await tx<BatchPlanContextRow[]>`
          select
            b.id as batch_id,
            p.workspace_id,
            p.connector_id,
            c.account_label,
            p.selected_categories,
            p.status as plan_status
          from import_batches b
          join import_plans p on p.id = b.plan_id
          join connectors c on c.id = p.connector_id
          where b.id = ${input.batchId}
        `;

        if (!context) {
          throw new ControlPlaneInputError(`Import batch ${input.batchId} does not exist.`);
        }

        const plannedRows = await tx<BatchSourceItemJoinRow[]>`
          select
            si.id,
            si.connector_id,
            si.snapshot_id,
            si.category,
            si.source_item_id,
            si.source_path,
            si.external_updated_at,
            si.byte_size_estimate,
            si.content_hash_hint,
            si.mime_type,
            si.title,
            si.inventory_state,
            si.download_disposition,
            si.imported_object_id,
            si.metadata,
            bsi.batch_id,
            bsi.ordinal as batch_ordinal,
            bsi.status as batch_status,
            bsi.planned_byte_size
          from batch_source_items bsi
          join source_items si on si.id = bsi.source_item_id
          where bsi.batch_id = ${input.batchId}
          order by bsi.ordinal asc
        `;

        const plannedIds = new Set(plannedRows.map((row) => row.id));
        const submittedIds = new Set(input.objects.map((row) => row.sourceItemId));

        if (plannedIds.size !== submittedIds.size || [...plannedIds].some((id) => !submittedIds.has(id))) {
          throw new ControlPlaneInputError(
            "Committed objects must match the exact set of source items planned for this batch."
          );
        }

        const manifests = await tx<ObjectManifestRow[]>`
          select
            id,
            workspace_id,
            connector_id,
            batch_id,
            category,
            object_count,
            chunk_count,
            bytes_plain_estimate,
            bytes_stored,
            bytes_skipped_dedup,
            integrity_state,
            verification_at,
            error,
            created_at
          from object_manifests
          where batch_id = ${input.batchId}
        `;

        const manifestByCategory = new Map(manifests.map((row) => [row.category, row]));
        const objectBySourceId = new Map(input.objects.map((row) => [row.sourceItemId, row]));
        const selectedCategories = parseSelectedCategories(context.selected_categories);

        await tx`
          update import_batches
          set status = 'manifest_committing'
          where id = ${input.batchId}
        `;

        const categoryTotals = new Map<
          Category,
          { processed: number; bytesStored: number; bytesSkipped: number }
        >();

        let storedObjectCount = 0;
        let dedupObjectCount = 0;
        let bytesDownloaded = 0;
        let bytesUploaded = 0;
        let dedupBytesSkipped = 0;

        for (const plannedRow of plannedRows) {
          const committedObject = objectBySourceId.get(plannedRow.id);
          const manifest = manifestByCategory.get(plannedRow.category);

          if (!committedObject || !manifest) {
            throw new ControlPlaneInputError("Batch manifest alignment failed during commit.");
          }

          const storedByteSize = committedObject.storedByteSize ?? committedObject.byteSize;
          bytesDownloaded += committedObject.byteSize;

          const categoryTotal = categoryTotals.get(plannedRow.category) ?? {
            processed: 0,
            bytesStored: 0,
            bytesSkipped: 0
          };
          categoryTotal.processed += 1;

          const [existingObject] = await tx<{ id: string }[]>`
            select id
            from stored_objects
            where workspace_id = ${context.workspace_id}
              and content_hash = ${committedObject.contentHash}
          `;

          if (existingObject) {
            dedupObjectCount += 1;
            dedupBytesSkipped += storedByteSize;
            categoryTotal.bytesSkipped += storedByteSize;

            await tx`
              update batch_source_items
              set status = 'skipped_duplicate'
              where batch_id = ${input.batchId}
                and source_item_id = ${plannedRow.id}
            `;

            await tx`
              update source_items
              set
                inventory_state = 'skipped_duplicate',
                download_disposition = 'skipped_duplicate',
                imported_object_id = ${existingObject.id},
                updated_at = now()
              where id = ${plannedRow.id}
            `;

            await tx`
              insert into object_provenance (
                stored_object_id,
                connector_id,
                batch_id,
                category,
                source_path,
                source_item_id,
                source_account_label
              )
              values (
                ${existingObject.id},
                ${context.connector_id},
                ${input.batchId},
                ${plannedRow.category},
                ${plannedRow.source_path},
                ${plannedRow.source_item_id},
                ${context.account_label}
              )
            `;
          } else {
            const [storedObject] = await tx<{ id: string }[]>`
              insert into stored_objects (
                workspace_id,
                connector_id,
                batch_id,
                manifest_id,
                content_hash,
                storage_path,
                byte_size,
                stored_byte_size,
                mime_type,
                lane,
                title,
                summary,
                original_at,
                has_location,
                source_metadata
              )
              values (
                ${context.workspace_id},
                ${context.connector_id},
                ${input.batchId},
                ${manifest.id},
                ${committedObject.contentHash},
                ${generateStoragePath(context.workspace_id, plannedRow.category, committedObject.contentHash)},
                ${committedObject.byteSize},
                ${storedByteSize},
                ${committedObject.mimeType},
                ${laneForCategory(plannedRow.category)},
                ${committedObject.title ?? plannedRow.title},
                ${committedObject.summary ?? null},
                ${committedObject.originalAt ?? plannedRow.external_updated_at ?? null},
                ${committedObject.hasLocation ?? false},
                ${JSON.stringify(committedObject.sourceMetadata ?? toJsonObject(plannedRow.metadata))}::jsonb
              )
              returning id
            `;

            storedObjectCount += 1;
            bytesUploaded += storedByteSize;
            categoryTotal.bytesStored += storedByteSize;

            await tx`
              update batch_source_items
              set status = 'committed'
              where batch_id = ${input.batchId}
                and source_item_id = ${plannedRow.id}
            `;

            await tx`
              update source_items
              set
                inventory_state = 'imported',
                download_disposition = 'downloaded',
                imported_object_id = ${storedObject.id},
                updated_at = now()
              where id = ${plannedRow.id}
            `;

            await tx`
              insert into object_provenance (
                stored_object_id,
                connector_id,
                batch_id,
                category,
                source_path,
                source_item_id,
                source_account_label
              )
              values (
                ${storedObject.id},
                ${context.connector_id},
                ${input.batchId},
                ${plannedRow.category},
                ${plannedRow.source_path},
                ${plannedRow.source_item_id},
                ${context.account_label}
              )
            `;

            await tx`
              update workspaces
              set
                storage_used_bytes = storage_used_bytes + ${storedByteSize},
                updated_at = now()
              where id = ${context.workspace_id}
            `;
          }

          categoryTotals.set(plannedRow.category, categoryTotal);
        }

        for (const manifest of manifests) {
          const summary = categoryTotals.get(manifest.category) ?? {
            processed: 0,
            bytesStored: 0,
            bytesSkipped: 0
          };

          await tx`
            update object_manifests
            set
              object_count = ${summary.processed},
              chunk_count = ${summary.processed},
              bytes_stored = ${summary.bytesStored},
              bytes_skipped_dedup = ${summary.bytesSkipped},
              integrity_state = 'verified',
              verification_at = now(),
              error = null
            where id = ${manifest.id}
          `;
        }

        const [batchRow] = await tx<ImportBatchRow[]>`
          update import_batches
          set
            status = 'done',
            items_received = ${plannedRows.length},
            bytes_downloaded = ${bytesDownloaded},
            bytes_uploaded = ${bytesUploaded},
            dedup_hits = ${dedupObjectCount},
            dedup_bytes_skipped = ${dedupBytesSkipped},
            completed_at = now(),
            error = null
          where id = ${input.batchId}
          returning
            id,
            plan_id,
            connector_id,
            ordinal,
            status,
            items_expected,
            items_received,
            bytes_planned,
            bytes_downloaded,
            bytes_uploaded,
            dedup_hits,
            dedup_bytes_skipped,
            started_at,
            completed_at,
            error
        `;

        const remainingRows = await tx<SourceItemRow[]>`
          select
            id,
            connector_id,
            snapshot_id,
            category,
            source_item_id,
            source_path,
            external_updated_at,
            byte_size_estimate,
            content_hash_hint,
            mime_type,
            title,
            inventory_state,
            download_disposition,
            imported_object_id,
            metadata
          from source_items
          where connector_id = ${context.connector_id}
            and imported_object_id is null
            and download_disposition = 'defer'
        `;

        const remainingCount = remainingRows.filter((row) => selectedCategories.includes(row.category)).length;

        await tx`
          update import_plans
          set status = ${remainingCount > 0 ? "running" : "completed"}
          where id = ${batchRow.plan_id}
        `;

        await applyConnectorStateChange(tx, {
          connectorId: context.connector_id,
          toState: remainingCount > 0 ? "download_pending" : "uploaded",
          trigger: "import_batch_committed",
          details: {
            batchId: input.batchId,
            storedObjectCount,
            dedupObjectCount,
            remainingCount
          }
        });

        return {
          batch: mapImportBatch(batchRow),
          manifests: await listManifestsForBatch(tx, input.batchId),
          storedObjectCount,
          dedupObjectCount
        };
      });
    }
  };
}
