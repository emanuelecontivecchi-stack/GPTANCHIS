export type ExecutionLane = "deterministic" | "ai_assist";

export interface ConnectorExecutionDecision {
  lane: ExecutionLane;
  reason: string;
  requiresTypedNormalization: boolean;
}

export const aiAssistAllowedTasks = [
  "page_interpretation",
  "ui_recovery_guidance",
  "ambiguous_content_classification"
] as const;

export const deterministicOnlyTasks = [
  "connector_state_transition",
  "inventory_snapshot_commit",
  "storage_fit_evaluation",
  "manifest_commit",
  "dedup_outcome",
  "integrity_verification",
  "delete_eligibility"
] as const;

export type AiAssistTask = (typeof aiAssistAllowedTasks)[number];
export type DeterministicOnlyTask = (typeof deterministicOnlyTasks)[number];
export type ExecutionTask = AiAssistTask | DeterministicOnlyTask;

function isDeterministicOnlyTask(task: ExecutionTask): task is DeterministicOnlyTask {
  return (deterministicOnlyTasks as readonly string[]).includes(task);
}

export function decideExecutionLane(input: {
  deterministicConfidence: "high" | "medium" | "low";
  task: ExecutionTask;
}): ConnectorExecutionDecision {
  if (isDeterministicOnlyTask(input.task)) {
    return {
      lane: "deterministic",
      reason: "Trust-critical task must stay in deterministic code.",
      requiresTypedNormalization: false
    };
  }

  if (input.deterministicConfidence === "low") {
    return {
      lane: "ai_assist",
      reason: "Deterministic lane is not confident enough to continue safely.",
      requiresTypedNormalization: true
    };
  }

  return {
    lane: "deterministic",
    reason: "Deterministic lane is confident enough; AI assist is not needed.",
    requiresTypedNormalization: false
  };
}
