import { create } from "zustand";

import type { ProjectRules } from "./rules";

export type AgentStatus = "idle" | "running" | "waiting-approval" | "done" | "error" | "cancelled";

export type AgentStepStatus = "running" | "done" | "error" | "denied";

export type AgentTodoStatus = "pending" | "in_progress" | "done";

export interface AgentTodo {
  id: string;
  content: string;
  status: AgentTodoStatus;
}

export interface AgentStep {
  id: string;
  toolName: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
}

export interface AgentApproval {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  description?: string;
  resolve: (approved: boolean) => void;
}

export interface AgentEditReview {
  toolCallId: string;
  path: string;
  resolve: (accepted: boolean) => void;
}

interface AgentState {
  modeActive: boolean;
  status: AgentStatus;
  goal: string;
  steps: AgentStep[];
  stepCount: number;
  maxSteps: number;
  summary: string | null;
  error: string | null;
  pendingApprovals: AgentApproval[];
  checkpointedPaths: string[];
  todos: AgentTodo[];
  rules: ProjectRules | null;
  editReviews: AgentEditReview[];
  stopCallback: (() => void) | null;
}

interface AgentActions {
  setModeActive: (active: boolean) => void;
  startTask: (goal: string, maxSteps: number) => void;
  addStep: (step: AgentStep) => void;
  updateStep: (id: string, patch: Partial<AgentStep>) => void;
  setStatus: (status: AgentStatus) => void;
  finishTask: (summary: string) => void;
  failTask: (error: string) => void;
  requestApproval: (approval: Omit<AgentApproval, "resolve">) => Promise<boolean>;
  resolveApproval: (toolCallId: string, approved: boolean) => void;
  requestEditReview: (review: Omit<AgentEditReview, "resolve">) => Promise<boolean>;
  resolveEditReview: (toolCallId: string, accepted: boolean) => void;
  markCheckpointed: (path: string) => void;
  setTodos: (items: AgentTodo[], merge: boolean) => void;
  setRules: (rules: ProjectRules | null) => void;
  setStopCallback: (callback: (() => void) | null) => void;
  requestStop: () => void;
}

const initialState: AgentState = {
  modeActive: false,
  status: "idle",
  goal: "",
  steps: [],
  stepCount: 0,
  maxSteps: 30,
  summary: null,
  error: null,
  pendingApprovals: [],
  checkpointedPaths: [],
  todos: [],
  rules: null,
  editReviews: [],
  stopCallback: null,
};

export const useAgentStore = create<AgentState & AgentActions>()((set, get) => ({
  ...initialState,

  setModeActive: (active) => set({ modeActive: active }),

  startTask: (goal, maxSteps) =>
    set({
      status: "running",
      goal,
      steps: [],
      stepCount: 0,
      maxSteps,
      summary: null,
      error: null,
      pendingApprovals: [],
      checkpointedPaths: [],
      todos: [],
      editReviews: [],
    }),

  addStep: (step) =>
    set((state) => ({
      steps: [...state.steps, step],
      stepCount: state.stepCount + 1,
    })),

  updateStep: (id, patch) =>
    set((state) => ({
      steps: state.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    })),

  setStatus: (status) => set({ status }),

  finishTask: (summary) => {
    for (const review of get().editReviews) review.resolve(false);
    set({ status: "done", summary, pendingApprovals: [], editReviews: [] });
  },

  failTask: (error) => {
    for (const review of get().editReviews) review.resolve(false);
    set({ status: "error", error, pendingApprovals: [], editReviews: [] });
  },

  requestApproval: (approval) =>
    new Promise<boolean>((resolve) => {
      set((state) => ({
        status: "waiting-approval",
        pendingApprovals: [...state.pendingApprovals, { ...approval, resolve }],
      }));
    }),

  resolveApproval: (toolCallId, approved) => {
    const approval = get().pendingApprovals.find((a) => a.toolCallId === toolCallId);
    set((state) => ({
      status: "running",
      pendingApprovals: state.pendingApprovals.filter((a) => a.toolCallId !== toolCallId),
    }));
    approval?.resolve(approved);
  },

  requestEditReview: (review) =>
    new Promise<boolean>((resolve) => {
      set((state) => ({
        status: "waiting-approval",
        editReviews: [...state.editReviews, { ...review, resolve }],
      }));
    }),

  resolveEditReview: (toolCallId, accepted) => {
    const review = get().editReviews.find((r) => r.toolCallId === toolCallId);
    set((state) => ({
      status: "running",
      editReviews: state.editReviews.filter((r) => r.toolCallId !== toolCallId),
    }));
    review?.resolve(accepted);
  },

  markCheckpointed: (path) =>
    set((state) => ({
      checkpointedPaths: state.checkpointedPaths.includes(path)
        ? state.checkpointedPaths
        : [...state.checkpointedPaths, path],
    })),

  setTodos: (items, merge) =>
    set((state) => {
      if (!merge) return { todos: items };
      const byId = new Map<string, AgentTodo>(state.todos.map((todo) => [todo.id, todo] as const));
      for (const item of items) {
        byId.set(item.id, item);
      }
      return { todos: [...byId.values()] };
    }),

  setRules: (rules) => set({ rules }),

  setStopCallback: (callback) => set({ stopCallback: callback }),

  requestStop: () => {
    const { stopCallback, pendingApprovals, editReviews } = get();
    for (const approval of pendingApprovals) {
      approval.resolve(false);
    }
    for (const review of editReviews) {
      review.resolve(false);
    }
    set({ status: "cancelled", pendingApprovals: [], editReviews: [] });
    stopCallback?.();
  },
}));
