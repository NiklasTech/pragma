import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { crossWindowSync } from "./sync/crossWindowSync";

export type TerminalSessionType = "shell" | "docker-logs" | "docker-exec";

export interface TerminalSession {
  id: string;
  name: string;
  type: TerminalSessionType;
  shell?: string;
  command?: string;
  cwd?: string;
  isActive: boolean;
  ptyId?: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  defaultShell: string;
  fontSize: number;
  fontFamily: string;
  scrollback: number;
  aiSuggestions: boolean;
}

interface TerminalActions {
  addSession: (session: Omit<TerminalSession, "ptyId">) => Promise<void>;
  removeSession: (sessionId: string) => void;
  killSession: (sessionId: string) => Promise<void>;
  killAllSessions: () => Promise<void>;
  attachPty: (sessionId: string, ptyId: string) => void;
  setActiveSession: (sessionId: string) => void;
  updateSessionCwd: (sessionId: string, cwd: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  setDefaultShell: (shell: string) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setScrollback: (lines: number) => void;
  setAiSuggestions: (enabled: boolean) => void;
}

const initialState: TerminalState = {
  sessions: [],
  activeSessionId: null,
  defaultShell: "",
  fontSize: 13,
  fontFamily: "Geist Mono Variable",
  scrollback: 10000,
  aiSuggestions: true,
};

async function createPtyForSession(
  session: Omit<TerminalSession, "ptyId">,
): Promise<string | undefined> {
  try {
    if (session.type !== "shell" && session.command) {
      return await invoke<string>("create_pty_command", {
        command: session.command,
        cwd: session.cwd ?? null,
        cols: 80,
        rows: 24,
      });
    }

    const shell = session.shell?.trim().length ? session.shell : undefined;
    return await invoke<string>("create_pty", {
      shell,
      cols: 80,
      rows: 24,
    });
  } catch {
    return undefined;
  }
}

export const useTerminalStore = create<TerminalState & TerminalActions>(
  crossWindowSync<TerminalState & TerminalActions>("terminal")((set, get) => ({
    ...initialState,

    addSession: async (session) => {
      const ptyId = await createPtyForSession(session);
      const nextSession: TerminalSession = { ...session, ptyId };
      set({
        sessions: [...get().sessions, nextSession],
        activeSessionId: nextSession.id,
      });
    },

    removeSession: (sessionId) => {
      const { sessions, activeSessionId } = get();
      const nextSessions = sessions.filter((s) => s.id !== sessionId);
      let nextActive = activeSessionId;
      if (activeSessionId === sessionId) {
        nextActive = nextSessions.length > 0 ? nextSessions[nextSessions.length - 1].id : null;
      }
      set({
        sessions: nextSessions,
        activeSessionId: nextActive,
      });
    },

    killSession: async (sessionId) => {
      const { sessions } = get();
      const session = sessions.find((s) => s.id === sessionId);
      if (session?.ptyId) {
        try {
          await invoke("kill_pty", { id: session.ptyId });
        } catch {
          // ignore
        }
      }
      const nextSessions = sessions.filter((s) => s.id !== sessionId);
      const nextActive =
        get().activeSessionId === sessionId
          ? nextSessions.length > 0
            ? nextSessions[nextSessions.length - 1].id
            : null
          : get().activeSessionId;
      set({ sessions: nextSessions, activeSessionId: nextActive });
    },

    killAllSessions: async () => {
      const { sessions } = get();
      await Promise.all(
        sessions.map(async (session) => {
          if (session.ptyId) {
            try {
              await invoke("kill_pty", { id: session.ptyId });
            } catch {
              // ignore
            }
          }
        }),
      );
      set({ sessions: [], activeSessionId: null });
    },

    attachPty: (sessionId, ptyId) => {
      set({
        sessions: get().sessions.map((s) => (s.id === sessionId ? { ...s, ptyId } : s)),
      });
    },

    setActiveSession: (sessionId) => {
      set({
        activeSessionId: sessionId,
        sessions: get().sessions.map((s) => ({
          ...s,
          isActive: s.id === sessionId,
        })),
      });
    },

    updateSessionCwd: (sessionId, cwd) => {
      const { sessions } = get();
      set({
        sessions: sessions.map((s) => (s.id === sessionId ? { ...s, cwd } : s)),
      });
    },

    renameSession: (sessionId, name) => {
      const { sessions } = get();
      set({
        sessions: sessions.map((s) => (s.id === sessionId ? { ...s, name } : s)),
      });
    },

    setDefaultShell: (shell) => set({ defaultShell: shell }),
    setFontSize: (size) => set({ fontSize: size }),
    setFontFamily: (family) => set({ fontFamily: family }),
    setScrollback: (lines) => set({ scrollback: lines }),
    setAiSuggestions: (enabled) => set({ aiSuggestions: enabled }),
  })),
);
