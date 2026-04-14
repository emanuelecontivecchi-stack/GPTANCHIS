export const googleConnectorPolicy = {
  login: "manual_visible_browser_only",
  inventoryMode: "metadata_first",
  importMode: "reconciliation_based_incremental",
  deleteDefault: "disabled_until_verified",
  preferredLane: "deterministic_first",
  aiAssistFallback: "allowed_for_page_interpretation_only"
} as const;
