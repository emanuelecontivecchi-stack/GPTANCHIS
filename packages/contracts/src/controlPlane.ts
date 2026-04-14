import type {
  AcquisitionSurface,
  Category,
  CategoryInventory,
  CommittedImportBatch,
  Connector,
  ConnectorSettings,
  GoogleConnectorAuthResult,
  ImportPlan,
  MaterializedImportBatch,
  SourceItem,
  StorageComparison,
  Workspace
} from "./entities.js";
import type { GoogleExportGuideAction } from "./states.js";

export interface CreateWorkspaceInput {
  ownerId: string;
  planState?: Workspace["planState"];
  agentState?: Workspace["agentState"];
  storageCapacityBytes: number;
}

export interface RegisterConnectorInput {
  workspaceId: string;
  platform: Connector["platform"];
  accountLabel: string;
  surface: AcquisitionSurface;
  extractionStrategy?: Connector["extractionStrategy"];
  deleteCapability?: Connector["deleteCapability"];
  settings?: ConnectorSettings;
}

export interface RecordInventorySnapshotInput {
  connectorId: string;
  categories: CategoryInventory[];
  comparison: StorageComparison;
  generatedAt?: string;
}

export interface DiscoveredSourceItemInput {
  category: Category;
  externalItemId: string;
  sourcePath?: string | null;
  externalUpdatedAt?: string | null;
  byteSizeEstimate?: number | null;
  contentHashHint?: string | null;
  mimeType?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DraftImportPlanInput {
  workspaceId: string;
  connectorId: string;
  snapshotId: string;
  categories: Category[];
  mode?: ImportPlan["mode"];
  sourceAction: ImportPlan["sourceAction"];
}

export interface RunConnectorInventoryInput {
  connectorId: string;
}

export interface PrepareGoogleConnectorAuthInput {
  connectorId: string;
}

export interface CompleteGoogleConnectorAuthInput {
  connectorId: string;
  sessionId: GoogleConnectorAuthResult["session"]["sessionId"];
}

export interface CheckGoogleConnectorExportInput {
  connectorId: string;
}

export interface AdvanceGoogleConnectorExportInput {
  connectorId: string;
  action: GoogleExportGuideAction;
}

export interface OpenGoogleConnectorExportRootInput {
  connectorId: string;
}

export interface MaterializeImportBatchInput {
  planId: string;
  batchSize?: number;
}

export interface CommittedBatchObjectInput {
  sourceItemId: SourceItem["sourceItemId"];
  contentHash: string;
  byteSize: number;
  storedByteSize?: number;
  mimeType: string;
  title?: string;
  summary?: string;
  originalAt?: string | null;
  hasLocation?: boolean;
  sourceMetadata?: Record<string, unknown>;
}

export interface CommitImportBatchInput {
  batchId: MaterializedImportBatch["batch"]["batchId"];
  objects: CommittedBatchObjectInput[];
}
