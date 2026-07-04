import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface OnboardingState {
  isLoading: boolean;
  isCompleted: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  complete: () => Promise<void>;
  skip: () => Promise<void>;
}

async function fetchCompletionStatus(): Promise<boolean> {
  try {
    return await invoke<boolean>("get_onboarding_completed");
  } catch {
    return false;
  }
}

async function persistCompletionStatus(completed: boolean): Promise<void> {
  await invoke("set_onboarding_completed", { completed });
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isLoading: true,
  isCompleted: false,
  initialized: false,

  initialize: async () => {
    const completed = await fetchCompletionStatus();
    set({ isLoading: false, isCompleted: completed, initialized: true });
  },

  complete: async () => {
    set({ isCompleted: true });
    await persistCompletionStatus(true);
  },

  skip: async () => {
    set({ isCompleted: true });
    await persistCompletionStatus(true);
  },
}));
