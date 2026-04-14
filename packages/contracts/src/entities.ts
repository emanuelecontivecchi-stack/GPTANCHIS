import type {
  ConnectorAuthState,
  ConnectorExportState,
  ConnectorState,
  DeleteState,
  GoogleAuthSessionState,
  GoogleExportGuideState,
  GoogleExportSessionState,
  ImportBatchState,
  ImportPlanState,
  InventorySnapshotState,
  SourceItemDownloadDisposition,
  SourceItemInventoryState,
  StorageFitState,
  VisibilityLane
} from "./states.js";

export type Category = "photos" | "mail" | "files" | "contacts" | "geolocation";

export type AcquisitionSurface = "browser_account" | "local_folder";

export interface ConnectorSettings {
  inventoryProfile?: string | null;
  rootPath?: string | null;
  maxFiles?: number | null;
}

export interface CategoryInventory {
  category: Category;
  itemCountEstimate: number | null;
  bytesEstimate: number | null;
  duplicateBytesEstimate: number | null;
  netNewBytesEstimate: number | null;
  importSupported: boolean;
  incrementalSupported: boolean;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}

export interface StorageComparison {
  sourceBytesEstimate: number | null;
  netNewBytesEstimate: number | null;
  existingAnchiseBytesEstimate: number | null;
  availableAnchiseBytes: number | null;
  fitState: StorageFitState;
}

export interface Workspace {
  workspaceId: string;
  ownerId: string;
  planState: "trial" | "active" | "limited";
  agentState: "not_installed" | "paired" | "action_needed";
  storageCapacityBytes: number;
  storageUsedBytes: number;
  createdAt: string;
}

export interface GoogleConnectorAuthSession {
  sessionId: string;
  connectorId: string;
  status: GoogleAuthSessionState;
  loginMode: "manual_visible_browser";
  continueUrl: string;
  launchUrl: string;
  requestedCategories: Category[];
  preparedAt: string;
  authenticatedAt: string | null;
}

export interface GoogleConnectorExportSession {
  sessionId: string;
  connectorId: string;
  status: GoogleExportSessionState;
  exportRootPath: string;
  handoffUrl: string | null;
  archiveExpectation: string | null;
  orchestrationSteps: string[];
  watchFolderReadyAt: string | null;
  guideState: GoogleExportGuideState;
  categoriesConfirmedAt: string | null;
  exportRequestedAt: string | null;
  awaitingArchiveAt: string | null;
  requestedCategories: Category[];
  waitingStartedAt: string;
  lastCheckedAt: string | null;
  detectedAt: string | null;
  detectedItemCount: number | null;
  detectedCategories: Category[];
  autoInventoryStartedAt: string | null;
  inventoryCompletedAt: string | null;
}

export interface Connector {
  connectorId: string;
  workspaceId: string;
  platform: "google" | "local_hardware";
  accountLabel: string;
  surface: AcquisitionSurface;
  state: ConnectorState;
  extractionStrategy: "api" | "browser" | "export" | "physical" | "local";
  deleteCapability:
    | "direct_delete"
    | "deletion_request"
    | "account_deletion_only"
    | "download_only";
  authState: ConnectorAuthState;
  authSession: GoogleConnectorAuthSession | null;
  exportState: ConnectorExportState;
  exportSession: GoogleConnectorExportSession | null;
  settings: ConnectorSettings;
  inventoryCursor: Record<string, unknown>;
  lastInventoryAt: string | null;
  lastError: string | null;
}

export interface InventorySnapshot {
  inventoryId: string;
  connectorId: string;
  status: InventorySnapshotState;
  categories: CategoryInventory[];
  comparison: StorageComparison;
  generatedAt: string;
}

export interface ImportPlan {
  planId: string;
  workspaceId: string;
  connectorId: string;
  snapshotId: string;
  categories: Category[];
  mode: "incremental";
  sourceAction: "download_only" | "download_and_delete_source";
  sourceBytesEstimate: number | null;
  netNewBytesEstimate: number | null;
  availableAnchiseBytes: number | null;
  fitState: StorageFitState;
  status: ImportPlanState;
  requestedAt: string;
  confirmedAt: string | null;
}

export interface ImportBatch {
  batchId: string;
  planId: string;
  connectorId: string;
  ordinal: number;
  status: ImportBatchState;
  itemsExpected: number;
  itemsReceived: number;
  bytesPlanned: number;
  bytesDownloaded: number;
  bytesUploaded: number;
  dedupHits: number;
  dedupBytesSkipped: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface ObjectManifest {
  manifestId: string;
  workspaceId: string;
  connectorId: string;
  batchId: string;
  category: Category;
  objectCount: number;
  chunkCount: number;
  bytesPlainEstimate: number;
  bytesStored: number;
  bytesSkippedDedup: number;
  integrityState: "pending" | "verified" | "failed";
  verificationAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface SourceItem {
  sourceItemId: string;
  connectorId: string;
  snapshotId: string | null;
  category: Category;
  externalItemId: string;
  sourcePath: string | null;
  externalUpdatedAt: string | null;
  byteSizeEstimate: number | null;
  contentHashHint: string | null;
  mimeType: string | null;
  title: string | null;
  inventoryState: SourceItemInventoryState;
  downloadDisposition: SourceItemDownloadDisposition;
  importedObjectId: string | null;
  metadata: Record<string, unknown>;
}

export interface InventoryRunResult {
  snapshot: InventorySnapshot;
  discoveredItemCount: number;
  deferredItemCount: number;
  strategyLabel: string;
}

export interface MaterializedImportBatch {
  batch: ImportBatch;
  manifests: ObjectManifest[];
  sourceItems: SourceItem[];
}

export interface CommittedImportBatch {
  batch: ImportBatch;
  manifests: ObjectManifest[];
  storedObjectCount: number;
  dedupObjectCount: number;
}

export interface GoogleConnectorAuthResult {
  connector: Connector;
  session: GoogleConnectorAuthSession;
}

export interface GoogleConnectorExportCheckResult {
  connector: Connector;
  session: GoogleConnectorExportSession;
  inventoryRun: InventoryRunResult | null;
}

export interface GoogleConnectorExportProgressResult {
  connector: Connector;
  session: GoogleConnectorExportSession;
}

export interface GoogleConnectorExportRootOpenResult {
  connector: Connector;
  session: GoogleConnectorExportSession;
  openedPath: string;
}

export interface GoogleConnectorArchiveImportResult {
  connector: Connector;
  session: GoogleConnectorExportSession;
  inventoryRun: InventoryRunResult | null;
  uploadedFileName: string;
  extractedAt: string;
}

export interface ProvenanceRef {
  connectorId: string;
  batchId: string;
  category: Category;
  sourcePath: string | null;
  sourceItemId: string | null;
}

export interface ExplorerItem {
  explorerItemId: string;
  workspaceId: string;
  lane: VisibilityLane;
  objectHash: string;
  provenance: ProvenanceRef[];
}

export interface LocationImport {
  locationImportId: string;
  connectorId: string;
  importState: "inventory_ready" | "imported";
  deleteState: DeleteState;
}
