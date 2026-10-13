import { useAIStore, type ChatSession, type WorkEnvironment } from "@/shared/stores/ai";

import { sessionEnvironment } from "./cwd";

export function useSessionEnvironment(
  session: Pick<ChatSession, "environmentId"> | null | undefined,
): WorkEnvironment | undefined {
  return useAIStore((state) => sessionEnvironment(session ?? undefined, state.workEnvironments));
}
