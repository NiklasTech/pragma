import type { StreamUsage } from "@/shared/lib/ai/protocol";
import type { AIActions, AISlice, SessionUsage } from "./types";

const EMPTY_USAGE: SessionUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  responses: 0,
};

export function addStreamUsage(
  current: SessionUsage | undefined,
  usage: StreamUsage,
): SessionUsage {
  const next: SessionUsage = { ...(current ?? EMPTY_USAGE) };

  if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    next.inputTokens += input;
    next.outputTokens += output;
    next.cacheReadTokens += usage.cache_read_tokens ?? 0;
    next.cacheWriteTokens += usage.cache_write_tokens ?? 0;
    next.responses += 1;
    // An agent that reports its context fill knows it better than this estimate.
    if (next.contextWindow === undefined) next.contextTokens = input + output;
  }

  if (usage.context_used !== undefined) {
    next.contextTokens = usage.context_used;
    if (usage.context_size !== undefined) next.contextWindow = usage.context_size;
  }

  return next;
}

export const createUsageSlice: AISlice<
  Pick<AIActions, "recordSessionUsage" | "setSessionContextTokens">
> = (set, get) => ({
  recordSessionUsage: (sessionId, usage) => {
    set({
      chatSessions: get().chatSessions.map((session) =>
        session.id === sessionId
          ? { ...session, usage: addStreamUsage(session.usage, usage) }
          : session,
      ),
    });
  },

  setSessionContextTokens: (sessionId, tokens) => {
    set({
      chatSessions: get().chatSessions.map((session) =>
        session.id === sessionId && session.usage
          ? { ...session, usage: { ...session.usage, contextTokens: tokens } }
          : session,
      ),
    });
  },
});
