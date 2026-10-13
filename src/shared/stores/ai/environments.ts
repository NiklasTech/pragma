import {
  deleteEnvironment as deleteStoredEnvironment,
  loadEnvironments as loadStoredEnvironments,
  saveEnvironment as saveStoredEnvironment,
} from "@/shared/lib/environment-storage";
import type { AIActions, AISlice } from "./types";

export const createEnvironmentsSlice: AISlice<
  Pick<AIActions, "loadEnvironments" | "saveEnvironment" | "deleteEnvironment">
> = (set, get) => ({
  loadEnvironments: async (rootPath) => {
    set({ workEnvironments: await loadStoredEnvironments(rootPath) });
  },

  saveEnvironment: async (rootPath, environment) => {
    await saveStoredEnvironment(rootPath, environment);
    const others = get().workEnvironments.filter((item) => item.id !== environment.id);
    set({ workEnvironments: [...others, environment] });
  },

  deleteEnvironment: async (rootPath, environmentId) => {
    await deleteStoredEnvironment(rootPath, environmentId);
    set({ workEnvironments: get().workEnvironments.filter((item) => item.id !== environmentId) });
  },
});
