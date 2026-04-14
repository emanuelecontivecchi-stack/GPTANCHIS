export const agentResponsibilities = [
  "launch visible browser lanes",
  "maintain connector-scoped session state",
  "run lightweight inventory",
  "stage local files only when acquisition is confirmed",
  "upload resumably into Anchise cloud",
  "report structured progress and failures"
] as const;

export const googleRuntimePolicy = {
  authentication: "manual_user_login_in_visible_browser",
  sessionModel: "persistent_per_connector_lane",
  browserControl: "deterministic_runner_only",
  headlessCredentials: false,
  deleteAutomationDefault: false
} as const;

export * from "./googleBrowserLane.js";
export * from "./googleConnectorPolicy.js";
export * from "./runtimePolicy.js";
