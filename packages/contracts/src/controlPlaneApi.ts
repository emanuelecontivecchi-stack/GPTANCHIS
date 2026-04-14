import type {
  GoogleConnectorArchiveImportResult,
  GoogleConnectorExportProgressResult,
  GoogleConnectorExportRootOpenResult,
  CommittedImportBatch,
  Connector,
  GoogleConnectorAuthResult,
  GoogleConnectorExportCheckResult,
  ImportPlan,
  ImportBatch,
  InventoryRunResult,
  InventorySnapshot,
  MaterializedImportBatch,
  Workspace
} from "./entities.js";
import type {
  AdvanceGoogleConnectorExportInput,
  CommitImportBatchInput,
  CheckGoogleConnectorExportInput,
  CompleteGoogleConnectorAuthInput,
  CreateWorkspaceInput,
  DraftImportPlanInput,
  MaterializeImportBatchInput,
  OpenGoogleConnectorExportRootInput,
  PrepareGoogleConnectorAuthInput,
  RecordInventorySnapshotInput,
  RegisterConnectorInput,
  RunConnectorInventoryInput
} from "./controlPlane.js";

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorPayload;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type CreateWorkspaceRequest = CreateWorkspaceInput;
export interface GetWorkspaceRequest {
  workspaceId: string;
}

export type RegisterConnectorRequest = RegisterConnectorInput;
export interface ListConnectorsRequest {
  workspaceId: string;
}

export type RecordInventorySnapshotRequest = RecordInventorySnapshotInput;
export type DraftImportPlanRequest = DraftImportPlanInput;
export type RunConnectorInventoryRequest = RunConnectorInventoryInput;
export type PrepareGoogleConnectorAuthRequest = PrepareGoogleConnectorAuthInput;
export type CompleteGoogleConnectorAuthRequest = CompleteGoogleConnectorAuthInput;
export type CheckGoogleConnectorExportRequest = CheckGoogleConnectorExportInput;
export type AdvanceGoogleConnectorExportRequest = AdvanceGoogleConnectorExportInput;
export type OpenGoogleConnectorExportRootRequest = OpenGoogleConnectorExportRootInput;
export type MaterializeImportBatchRequest = MaterializeImportBatchInput;
export type CommitImportBatchRequest = CommitImportBatchInput;

export interface ConfirmImportPlanRequest {
  planId: string;
}

export type CreateWorkspaceResponse = ApiResult<Workspace>;
export type GetWorkspaceResponse = ApiResult<Workspace>;
export type RegisterConnectorResponse = ApiResult<Connector>;
export type ListConnectorsResponse = ApiResult<Connector[]>;
export type RecordInventorySnapshotResponse = ApiResult<InventorySnapshot>;
export type DraftImportPlanResponse = ApiResult<ImportPlan>;
export type ConfirmImportPlanResponse = ApiResult<ImportPlan>;
export type RunConnectorInventoryResponse = ApiResult<InventoryRunResult>;
export type PrepareGoogleConnectorAuthResponse = ApiResult<GoogleConnectorAuthResult>;
export type CompleteGoogleConnectorAuthResponse = ApiResult<GoogleConnectorAuthResult>;
export type CheckGoogleConnectorExportResponse = ApiResult<GoogleConnectorExportCheckResult>;
export type AdvanceGoogleConnectorExportResponse = ApiResult<GoogleConnectorExportProgressResult>;
export type OpenGoogleConnectorExportRootResponse = ApiResult<GoogleConnectorExportRootOpenResult>;
export type UploadGoogleConnectorArchiveResponse = ApiResult<GoogleConnectorArchiveImportResult>;
export type MaterializeImportBatchResponse = ApiResult<MaterializedImportBatch>;
export type CommitImportBatchResponse = ApiResult<CommittedImportBatch>;
