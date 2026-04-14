export const apiBootstrapOrder = [
  "workspace registry",
  "connector registry",
  "inventory snapshots",
  "import plans",
  "storage-fit evaluation",
  "manifest records",
  "recent import and explorer indices"
] as const;

export const apiHardRules = [
  "Inventory must be computed before any acquisition starts.",
  "Storage fit must be visible before an import plan is confirmed.",
  "Delete from source cannot be exposed until verification thresholds pass.",
  "Every stored object must retain provenance back to connector, batch, and category."
] as const;

export const apiFirstRepositorySlice = [
  "create workspace",
  "register connector",
  "record inventory snapshot",
  "draft import plan",
  "confirm import plan"
] as const;

export const apiControlPlaneRoutes = [
  "POST /api/control-plane/workspaces",
  "POST /api/control-plane/workspaces/get",
  "POST /api/control-plane/connectors",
  "POST /api/control-plane/connectors/list",
  "POST /api/control-plane/inventory-snapshots",
  "POST /api/control-plane/import-plans",
  "POST /api/control-plane/import-plans/confirm"
] as const;
