import { useAIStore } from "@/shared/stores/ai";

import { countSharers } from "./shared";

/** How many listed sessions work in the same environment as this one. */
export function useSharers(environmentId: string | undefined): number {
  return useAIStore((state) => countSharers(state.chatSessions, environmentId));
}
