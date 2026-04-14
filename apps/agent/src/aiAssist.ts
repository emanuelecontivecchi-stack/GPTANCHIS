export interface AiAssistInput {
  connectorId: string;
  platform: "google" | "local_hardware";
  goal: "interpret_page" | "recover_ui" | "classify_content";
  promptContext: string;
}

export interface AiAssistOutput {
  summary: string;
  proposedAction: string | null;
  confidence: "low" | "medium" | "high";
  rawProvider: "openclaw_qwen";
}

// This is the narrow boundary where OpenClaw + Qwen can be connected later.
// Everything returned here must be normalized into typed deterministic actions
// before the rest of the system can trust it.
export async function runAiAssist(_input: AiAssistInput): Promise<AiAssistOutput> {
  return {
    summary: "AI assist adapter not yet connected.",
    proposedAction: null,
    confidence: "low",
    rawProvider: "openclaw_qwen"
  };
}
