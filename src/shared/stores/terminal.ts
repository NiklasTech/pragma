import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { crossWindowSync } from "./sync/crossWindowSync";

export type TerminalSessionType = "shell" | "docker-logs" | "docker-exec" | "run";

export interface TerminalSession {
  id: string;
  name: string;
  type: TerminalSessionType;
  shell?: string;
  command?: string;
  cwd?: string;
  processId?: string;
  isActive: boolean;
  ptyId?: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  defaultShell: string;
  shellResolved: boolean;
  fontSize: number;
  fontFamily: string;
  fontId: string;
  scrollback: number;
  aiSuggestions: boolean;
}

interface TerminalActions {
  addSession: (session: Omit<TerminalSession, "ptyId">) => void;
  addRunSession: (processId: string, name: string, command: string) => void;
  focusRunSession: (processId: string) => void;
  ensureInitialSession: (session: Omit<TerminalSession, "ptyId">) => void;
  removeSession: (sessionId: string) => void;
  killSession: (sessionId: string) => Promise<void>;
  killAllSessions: () => Promise<void>;
  reloadSession: (sessionId: string, shell: string) => Promise<void>;
  attachPty: (sessionId: string, ptyId: string) => void;
  setShellResolved: (resolved: boolean) => void;
  setActiveSession: (sessionId: string) => void;
  updateSessionCwd: (sessionId: string, cwd: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  setDefaultShell: (shell: string) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setFontId: (id: string) => void;
  setScrollback: (lines: number) => void;
  setAiSuggestions: (enabled: boolean) => void;
}

const initialState: TerminalState = {
  sessions: [],
  activeSessionId: null,
  defaultShell: "",
  shellResolved: false,
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  fontId: "",
  scrollback: 10000,
  aiSuggestions: true,
};

export const useTerminalStore = create<TerminalState & TerminalActions>(
  crossWindowSync<TerminalState & TerminalActions>("terminal")((set, get) => ({
    ...initialState,

    addSession: (session) => {
      const nextSession: TerminalSession = { ...session };
      set({
        sessions: [...get().sessions, nextSession],
        activeSessionId: nextSession.id,
      });
    },

    addRunSession: (processId, name, command) => {
      const { sessions } = get();
      const existing = sessions.find((s) => s.type === "run" && s.processId === processId);
      if (existing) {
        set({ activeSessionId: existing.id });
        return;
      }

      const nextSession: TerminalSession = {
        id: crypto.randomUUID(),
        name,
        type: "run",
        command,
        processId,
        isActive: true,
      };
      set({
        sessions: [...sessions, nextSession],
        activeSessionId: nextSession.id,
      });
    },

    focusRunSession: (processId) => {
      const { sessions } = get();
      const existing = sessions.find((s) => s.type === "run" && s.processId === processId);
      if (existing) {
        set({ activeSessionId: existing.id });
      }
    },

    ensureInitialSession: (session) => {
      const { sessions } = get();
      if (sessions.length > 0) return;

      const nextSession: TerminalSession = { ...session };
      set({
        sessions: [nextSession],
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
      const { sessions, activeSessionId } = get();
      const session = sessions.find((s) => s.id === sessionId);

      // Remove the session from React state first so TerminalSession unmounts
      // and disconnects its ResizeObserver before the PTY is destroyed.
      const nextSessions = sessions.filter((s) => s.id !== sessionId);
      const nextActive =
        activeSessionId === sessionId
          ? nextSessions.length > 0
            ? nextSessions[nextSessions.length - 1].id
            : null
          : activeSessionId;
      set({ sessions: nextSessions, activeSessionId: nextActive });

      if (session?.ptyId) {
        try {
          await invoke("kill_pty", { id: session.ptyId });
        } catch {
          // ignore
        }
      }
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

    reloadSession: async (sessionId, shell) => {
      const { sessions } = get();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session || session.command) return;

      if (session.ptyId) {
        try {
          await invoke("kill_pty", { id: session.ptyId });
        } catch {
          // ignore
        }
      }

      set({
        sessions: sessions.map((s) => (s.id === sessionId ? { ...s, shell, ptyId: undefined } : s)),
      });
    },

    attachPty: (sessionId, ptyId) => {
      set({
        sessions: get().sessions.map((s) => (s.id === sessionId ? { ...s, ptyId } : s)),
      });
    },

    setShellResolved: (resolved) => set({ shellResolved: resolved }),

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

    setDefaultShell: (shell) => set({ defaultShell: shell, shellResolved: true }),
    setFontSize: (size) => set({ fontSize: size }),
    setFontFamily: (family) => set({ fontFamily: family }),
    setFontId: (id) => set({ fontId: id }),
    setScrollback: (lines) => set({ scrollback: lines }),
    setAiSuggestions: (enabled) => set({ aiSuggestions: enabled }),
  })),
);
