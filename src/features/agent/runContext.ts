import type { AgentEngine } from "@/shared/stores/ai";

import { applyAgentFileEdit, type AgentFileEdit } from "./applyEdit";
import type { AgentApprovalDecision } from "./permissions";
import { useAgentStore, type AgentApproval, type AgentStep, type AgentTodo } from "./store";

/// Where an agent tool call reports to: the focused chat's run, or a background child run.
export interface AgentRunContext {
  sessionId: () => string | null;
  childEngine: () => AgentEngine | null;
  isCancelled: () => boolean;
  addStep: (step: AgentStep) => void;
  updateStep: (id: string, patch: Partial<AgentStep>) => void;
  requestApproval: (approval: Omit<AgentApproval, "resolve">) => Promise<boolean>;
  setTodos: (items: AgentTodo[]) => number;
  finishTask: (summary: string) => void;
  applyFileEdit: (edit: AgentFileEdit, decision: AgentApprovalDecision) => Promise<void>;
}

export const foregroundRunContext: AgentRunContext = {
  sessionId: () => useAgentStore.getState().runSessionId,
  childEngine: () => null,
  isCancelled: () => useAgentStore.getState().status === "cancelled",
  addStep: (step) => useAgentStore.getState().addStep(step),
  updateStep: (id, patch) => useAgentStore.getState().updateStep(id, patch),
  requestApproval: (approval) => useAgentStore.getState().requestApproval(approval),
  setTodos: (items) => {
    useAgentStore.getState().setTodos(items, true);
    return useAgentStore.getState().todos.length;
  },
  finishTask: (summary) => useAgentStore.getState().finishTask(summary),
  applyFileEdit: applyAgentFileEdit,
};
