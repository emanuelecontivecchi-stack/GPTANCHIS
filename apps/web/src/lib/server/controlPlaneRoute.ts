import { createControlPlaneApi } from "@anchise/api/controlPlaneApi";

let controlPlaneApi: ReturnType<typeof createControlPlaneApi> | null = null;

function getControlPlaneApi(): ReturnType<typeof createControlPlaneApi> {
  if (!controlPlaneApi) {
    controlPlaneApi = createControlPlaneApi();
  }

  return controlPlaneApi;
}

type ControlPlaneHandlerName =
  | "createWorkspace"
  | "getWorkspace"
  | "registerConnector"
  | "listConnectors"
  | "prepareGoogleConnectorAuth"
  | "completeGoogleConnectorAuth"
  | "checkGoogleConnectorExport"
  | "advanceGoogleConnectorExport"
  | "openGoogleConnectorExportRoot"
  | "recordInventorySnapshot"
  | "draftImportPlan"
  | "confirmImportPlan"
  | "runConnectorInventory"
  | "materializeImportBatch"
  | "commitImportBatch";

export function createControlPlanePostRoute(handlerName: ControlPlaneHandlerName) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code: "invalid_json",
            message: "Request body must be valid JSON."
          }
        },
        { status: 400 }
      );
    }

    const result = await getControlPlaneApi()[handlerName](body);
    return Response.json(result.body, { status: result.status });
  };
}
