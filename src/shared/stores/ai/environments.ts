import {
  deleteEnvironment as deleteStoredEnvironment,
  loadEnvironments as loadStoredEnvironments,
  saveEnvironment as saveStoredEnvironment,
} from "@/shared/lib/environment-storage";
import type { AIActions, AISlice, WorkEnvironment } from "./types";

export function repositoryEnvironments(
  environments: readonly WorkEnvironment[],
  rootPath: string,
): WorkEnvironment[] {
  return environments.filter((environment) => environment.rootPath === rootPath);
}

export const createEnvironmentsSlice: AISlice<
  Pick<AIActions, "loadEnvironments" | "saveEnvironment" | "deleteEnvironment">
> = (set, get) => ({
  loadEnvironments: async (rootPath) => {
    const loaded = await loadStoredEnvironments(rootPath);
    const others = get().workEnvironments.filter((item) => item.rootPath !== rootPath);
    set({ workEnvironments: [...others, ...loaded] });
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
