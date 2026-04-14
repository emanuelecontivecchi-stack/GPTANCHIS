import type {
  AdvanceGoogleConnectorExportRequest,
  ApiResult,
  CheckGoogleConnectorExportRequest,
  CommitImportBatchRequest,
  ConfirmImportPlanRequest,
  CommittedImportBatch,
  CompleteGoogleConnectorAuthRequest,
  Connector,
  CreateWorkspaceRequest,
  DraftImportPlanRequest,
  GetWorkspaceRequest,
  GoogleConnectorAuthResult,
  GoogleConnectorExportCheckResult,
  GoogleConnectorExportProgressResult,
  GoogleConnectorExportRootOpenResult,
  InventoryRunResult,
  ImportPlan,
  InventorySnapshot,
  ListConnectorsRequest,
  MaterializeImportBatchRequest,
  MaterializedImportBatch,
  OpenGoogleConnectorExportRootRequest,
  PrepareGoogleConnectorAuthRequest,
  RecordInventorySnapshotRequest,
  RegisterConnectorRequest,
  RunConnectorInventoryRequest,
  Workspace
} from "@anchise/contracts";

export interface JsonTransport {
  request<T>(input: {
    method: "GET" | "POST";
    path: string;
    body?: unknown;
  }): Promise<ApiResult<T>>;
}

type JsonTransportRequest = Parameters<JsonTransport["request"]>[0];

export function createFetchJsonTransport(
  basePath = "/api/control-plane",
  fetchImpl: typeof fetch = fetch
): JsonTransport {
  return {
    async request<T>({ method, path, body }: JsonTransportRequest) {
      const response = await fetchImpl(`${basePath}${path}`, {
        method,
        headers: {
          "content-type": "application/json"
        },
        body: method === "GET" ? undefined : JSON.stringify(body)
      });

      return (await response.json()) as ApiResult<T>;
    }
  };
}

export interface ControlPlaneClient {
  createWorkspace(body: CreateWorkspaceRequest): Promise<ApiResult<Workspace>>;
  getWorkspace(body: GetWorkspaceRequest): Promise<ApiResult<Workspace>>;
  registerConnector(body: RegisterConnectorRequest): Promise<ApiResult<Connector>>;
  listConnectors(body: ListConnectorsRequest): Promise<ApiResult<Connector[]>>;
  prepareGoogleConnectorAuth(
    body: PrepareGoogleConnectorAuthRequest
  ): Promise<ApiResult<GoogleConnectorAuthResult>>;
  completeGoogleConnectorAuth(
    body: CompleteGoogleConnectorAuthRequest
  ): Promise<ApiResult<GoogleConnectorAuthResult>>;
  checkGoogleConnectorExport(
    body: CheckGoogleConnectorExportRequest
  ): Promise<ApiResult<GoogleConnectorExportCheckResult>>;
  advanceGoogleConnectorExport(
    body: AdvanceGoogleConnectorExportRequest
  ): Promise<ApiResult<GoogleConnectorExportProgressResult>>;
  openGoogleConnectorExportRoot(
    body: OpenGoogleConnectorExportRootRequest
  ): Promise<ApiResult<GoogleConnectorExportRootOpenResult>>;
  recordInventorySnapshot(
    body: RecordInventorySnapshotRequest
  ): Promise<ApiResult<InventorySnapshot>>;
  draftImportPlan(body: DraftImportPlanRequest): Promise<ApiResult<ImportPlan>>;
  confirmImportPlan(body: ConfirmImportPlanRequest): Promise<ApiResult<ImportPlan>>;
  runConnectorInventory(body: RunConnectorInventoryRequest): Promise<ApiResult<InventoryRunResult>>;
  materializeImportBatch(
    body: MaterializeImportBatchRequest
  ): Promise<ApiResult<MaterializedImportBatch>>;
  commitImportBatch(body: CommitImportBatchRequest): Promise<ApiResult<CommittedImportBatch>>;
}

export function createControlPlaneClient(
  transport: JsonTransport = createFetchJsonTransport()
): ControlPlaneClient {
  return {
    createWorkspace(body) {
      return transport.request<Workspace>({
        method: "POST",
        path: "/workspaces",
        body
      });
    },

    getWorkspace(body) {
      return transport.request<Workspace>({
        method: "POST",
        path: "/workspaces/get",
        body
      });
    },

    registerConnector(body) {
      return transport.request<Connector>({
        method: "POST",
        path: "/connectors",
        body
      });
    },

    listConnectors(body) {
      return transport.request<Connector[]>({
        method: "POST",
        path: "/connectors/list",
        body
      });
    },

    prepareGoogleConnectorAuth(body) {
      return transport.request<GoogleConnectorAuthResult>({
        method: "POST",
        path: "/connectors/google/prepare-auth",
        body
      });
    },

    completeGoogleConnectorAuth(body) {
      return transport.request<GoogleConnectorAuthResult>({
        method: "POST",
        path: "/connectors/google/complete-auth",
        body
      });
    },

    checkGoogleConnectorExport(body) {
      return transport.request<GoogleConnectorExportCheckResult>({
        method: "POST",
        path: "/connectors/google/check-export",
        body
      });
    },

    advanceGoogleConnectorExport(body) {
      return transport.request<GoogleConnectorExportProgressResult>({
        method: "POST",
        path: "/connectors/google/advance-export",
        body
      });
    },

    openGoogleConnectorExportRoot(body) {
      return transport.request<GoogleConnectorExportRootOpenResult>({
        method: "POST",
        path: "/connectors/google/open-export-root",
        body
      });
    },

    recordInventorySnapshot(body) {
      return transport.request<InventorySnapshot>({
        method: "POST",
        path: "/inventory-snapshots",
        body
      });
    },

    draftImportPlan(body) {
      return transport.request<ImportPlan>({
        method: "POST",
        path: "/import-plans",
        body
      });
    },

    confirmImportPlan(body) {
      return transport.request<ImportPlan>({
        method: "POST",
        path: "/import-plans/confirm",
        body
      });
    },

    runConnectorInventory(body) {
      return transport.request<InventoryRunResult>({
        method: "POST",
        path: "/inventory-runs",
        body
      });
    },

    materializeImportBatch(body) {
      return transport.request<MaterializedImportBatch>({
        method: "POST",
        path: "/import-batches/materialize",
        body
      });
    },

    commitImportBatch(body) {
      return transport.request<CommittedImportBatch>({
        method: "POST",
        path: "/import-batches/commit",
        body
      });
    }
  };
}
