import { create } from "zustand";

export type AgentStatus = "idle" | "running" | "waiting-approval" | "done" | "error" | "cancelled";

export type AgentStepStatus = "running" | "done" | "error" | "denied";

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
  markCheckpointed: (path: string) => void;
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

  finishTask: (summary) => set({ status: "done", summary, pendingApprovals: [] }),

  failTask: (error) => set({ status: "error", error, pendingApprovals: [] }),

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

  markCheckpointed: (path) =>
    set((state) => ({
      checkpointedPaths: state.checkpointedPaths.includes(path)
        ? state.checkpointedPaths
        : [...state.checkpointedPaths, path],
    })),

  setStopCallback: (callback) => set({ stopCallback: callback }),

  requestStop: () => {
    const { stopCallback, pendingApprovals } = get();
    for (const approval of pendingApprovals) {
      approval.resolve(false);
    }
    set({ status: "cancelled", pendingApprovals: [] });
    stopCallback?.();
  },
}));
