import type { UIMessage } from "ai";
import { create } from "zustand";

import type { AgentApproval, AgentTodo } from "@/features/agent/store";

export type ChildRunStatus = "running" | "waiting-approval" | "done" | "error" | "cancelled";

export interface ChildRun {
  status: ChildRunStatus;
  messages: UIMessage[];
  approvals: AgentApproval[];
  todos: AgentTodo[];
  summary: string | null;
  error: string | null;
}

interface ChildRunsState {
  runs: Record<string, ChildRun>;
}

export const useChildRunsStore = create<ChildRunsState>()(() => ({ runs: {} }));

export function isRunLive(run: ChildRun | undefined): boolean {
  return run?.status === "running" || run?.status === "waiting-approval";
}

export function getChildRun(sessionId: string): ChildRun | undefined {
  return useChildRunsStore.getState().runs[sessionId];
}

export function setChildRun(sessionId: string, run: ChildRun): void {
  useChildRunsStore.setState((state) => ({ runs: { ...state.runs, [sessionId]: run } }));
}

export function patchChildRun(sessionId: string, patch: Partial<ChildRun>): void {
  const current = getChildRun(sessionId);
  if (!current) return;
  setChildRun(sessionId, { ...current, ...patch });
}

export function requestChildApproval(
  sessionId: string,
  approval: Omit<AgentApproval, "resolve">,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const run = getChildRun(sessionId);
    if (!run || !isRunLive(run)) {
      resolve(false);
      return;
    }
    patchChildRun(sessionId, {
      status: "waiting-approval",
      approvals: [...run.approvals, { ...approval, resolve }],
    });
  });
}

export function resolveChildApproval(sessionId: string, toolCallId: string, approved: boolean) {
  const run = getChildRun(sessionId);
  const approval = run?.approvals.find((item) => item.toolCallId === toolCallId);
  if (!run || !approval) return;
  const approvals = run.approvals.filter((item) => item.toolCallId !== toolCallId);
  patchChildRun(sessionId, {
    approvals,
    status: approvals.length === 0 && run.status === "waiting-approval" ? "running" : run.status,
  });
  approval.resolve(approved);
}

export function mergeChildTodos(sessionId: string, items: AgentTodo[]): number {
  const run = getChildRun(sessionId);
  if (!run) return 0;
  const byId = new Map(run.todos.map((todo) => [todo.id, todo] as const));
  for (const item of items) byId.set(item.id, item);
  const todos = [...byId.values()];
  patchChildRun(sessionId, { todos });
  return todos.length;
}
