export type ConnectorState =
  | "not_connected"
  | "connected"
  | "inventorying"
  | "inventory_ready"
  | "download_pending"
  | "downloading"
  | "uploaded"
  | "organization_pending"
  | "organized"
  | "delete_eligible"
  | "delete_requested"
  | "deleted"
  | "action_needed"
  | "error";

export type ConnectorAuthState =
  | "not_required"
  | "not_started"
  | "awaiting_user"
  | "authenticated"
  | "reauth_required";

export type GoogleAuthSessionState = "prepared" | "authenticated" | "expired";

export type ConnectorExportState =
  | "not_required"
  | "not_started"
  | "awaiting_files"
  | "files_detected"
  | "inventory_started"
  | "inventory_completed";

export type GoogleExportSessionState =
  | "awaiting_files"
  | "files_detected"
  | "inventory_started"
  | "inventory_completed";

export type GoogleExportGuideState =
  | "handoff_ready"
  | "categories_confirmed"
  | "export_requested"
  | "awaiting_archive"
  | "files_detected"
  | "inventory_started"
  | "inventory_completed";

export type GoogleExportGuideAction =
  | "confirm_categories"
  | "mark_export_created"
  | "mark_waiting_for_archive";

export type InventoryJobState =
  | "queued"
  | "running"
  | "partial_result"
  | "complete"
  | "failed_retryable"
  | "failed_action_needed";

export type ImportBatchState =
  | "queued"
  | "preparing"
  | "extracting"
  | "staging"
  | "uploading"
  | "manifest_committing"
  | "uploaded"
  | "verified"
  | "organization_pending"
  | "done"
  | "failed";

export type SourceItemInventoryState =
  | "discovered"
  | "planned"
  | "imported"
  | "skipped_duplicate"
  | "missing";

export type SourceItemDownloadDisposition =
  | "defer"
  | "pending"
  | "downloaded"
  | "skipped_duplicate";

export type OrganizationState =
  | "not_started"
  | "running"
  | "review_needed"
  | "locked_candidate"
  | "complete"
  | "failed";

export type DeleteState =
  | "not_requested"
  | "requested_at_plan"
  | "delete_eligible"
  | "delete_in_progress"
  | "delete_confirmed"
  | "delete_requested_only"
  | "delete_partial"
  | "delete_failed"
  | "closure_not_supported";

export type VisibilityLane =
  | "organized"
  | "recent_import"
  | "locked_folder"
  | "review"
  | "location_history";

export type StorageFitState = "fits" | "likely_exceeds" | "exceeds" | "unknown";

export type InventorySnapshotState = "running" | "ready" | "superseded" | "failed";

export type ImportPlanState =
  | "draft"
  | "confirmed"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";
