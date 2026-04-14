import { createControlPlanePostRoute } from "../../../../../../lib/server/controlPlaneRoute.js";

export const dynamic = "force-dynamic";

export const POST = createControlPlanePostRoute("checkGoogleConnectorExport");
