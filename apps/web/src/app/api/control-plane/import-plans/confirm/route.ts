import { createControlPlanePostRoute } from "../../../../../lib/server/controlPlaneRoute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createControlPlanePostRoute("confirmImportPlan");
