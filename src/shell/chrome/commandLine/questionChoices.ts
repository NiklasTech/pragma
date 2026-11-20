import { resolveAcpApproval } from "@/features/ai/acp/acpApprovals";
import { resolveSpawnApproval } from "@/features/ai/children/acpSpawn";
import { stepLabel } from "@/features/agent/executor";

import { requestText, type Question } from "./question";

export interface QuestionChoice {
  key: string;
  label: string;
  main?: boolean;
  run: () => void;
}

/// The answers to a question, keyed y, a and n, and a way to the pane.
export function questionChoices(question: Question, onGo: () => void): QuestionChoice[] {
  const go: QuestionChoice = { key: "⏎", label: "go to pane", run: onGo };
  if (question.kind === "acp") {
    const { chatSessionId, toolCallId, alwaysLabel } = question.approval;
    const answer = (decision: "allow" | "allow_always" | "deny") => () =>
      void resolveAcpApproval(chatSessionId, toolCallId, decision);
    return [
      { key: "y", label: "allow once", main: true, run: answer("allow") },
      ...(alwaysLabel ? [{ key: "a", label: alwaysLabel, run: answer("allow_always") }] : []),
      { key: "n", label: "deny", run: answer("deny") },
      go,
    ];
  }
  if (question.kind === "spawn") {
    const { sessionId } = question.entry;
    const { toolCallId } = question.approval;
    return [
      {
        key: "y",
        label: "allow",
        main: true,
        run: () => resolveSpawnApproval(sessionId, toolCallId, true),
      },
      { key: "n", label: "deny", run: () => resolveSpawnApproval(sessionId, toolCallId, false) },
      go,
    ];
  }
  return [go];
}

/// What the agent asks, and the command or step it asks about.
export function questionSummary(
  question: Question,
  name: string,
): { text: string; request?: string } {
  if (question.kind === "acp") {
    return { text: `${name} wants to run`, request: requestText(question.approval.toolName) };
  }
  if (question.kind === "spawn") {
    const { label, detail } = stepLabel(question.approval.toolName, question.approval.args);
    return { text: `${name} wants to ${label.toLowerCase()}`, request: detail };
  }
  return { text: `${name} needs you` };
}
