import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import type { ChatSession } from "@/shared/stores/ai";

/// A slash command, skill or agent a coding CLI offers over ACP.
export interface AcpCommand {
  name: string;
  description: string;
  hint: string | null;
}

export interface AcpPlanEntry {
  content: string;
  priority: string;
  /** `pending`, `in_progress` or `completed`; agents may send other values. */
  status: string;
}

export interface AcpSessionInfo {
  /** The agent's id of the conversation, stored to continue it after a restart. */
  sessionId: string;
  commands: AcpCommand[];
  plan: AcpPlanEntry[];
}

export const ACP_SESSION_INFO_EVENT = "acp_session_info";

/// The stored conversation a chat continues; terminal sessions resume theirs in the terminal.
export function resumeSessionId(
  session: Pick<ChatSession, "kind" | "cliSessionId"> | undefined,
): string | null {
  if (!session || session.kind === "terminal") return null;
  return session.cliSessionId ?? null;
}

/// Commands whose name starts with the query come first, the agent's order is kept otherwise.
export function matchingCommands(commands: AcpCommand[], query: string): AcpCommand[] {
  const matches = commands.filter((command) => command.name.toLowerCase().includes(query));
  const starts = (command: AcpCommand) => command.name.toLowerCase().startsWith(query);
  return [...matches.filter(starts), ...matches.filter((command) => !starts(command))];
}

export function planProgress(plan: AcpPlanEntry[]): { done: number; total: number } {
  return {
    done: plan.filter((entry) => entry.status === "completed").length,
    total: plan.length,
  };
}

interface SessionInfoState {
  bySession: Record<string, AcpSessionInfo>;
  receive: (chatSessionId: string, info: AcpSessionInfo) => void;
  forget: (chatSessionId: string) => void;
  load: (chatSessionId: string) => Promise<void>;
}

export const useAcpSessionInfoStore = create<SessionInfoState>()((set, get) => ({
  bySession: {},

  receive: (chatSessionId, info) =>
    set((state) => ({ bySession: { ...state.bySession, [chatSessionId]: info } })),

  forget: (chatSessionId) =>
    set((state) => {
      const { [chatSessionId]: _info, ...bySession } = state.bySession;
      return { bySession };
    }),

  load: async (chatSessionId) => {
    try {
      const info = await invoke<AcpSessionInfo>("cli_acp_session_info", {
        req: { chat_session_id: chatSessionId },
      });
      get().receive(chatSessionId, info);
    } catch {
      // The session has not started yet; its first update arrives as an event.
    }
  },
}));
