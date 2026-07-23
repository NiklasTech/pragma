import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { crossWindowSync } from "./sync/crossWindowSync";

export type TerminalSessionType = "shell" | "docker-logs" | "docker-exec" | "run";

export interface TerminalSession {
  id: string;
  name: string;
  type: TerminalSessionType;
  /** Owning terminal panel. Undefined only for sessions created before panel scoping. */
  panelId?: string;
  shell?: string;
  command?: string;
  cwd?: string;
  processId?: string;
  isActive: boolean;
  ptyId?: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  /** panelId -> active sessionId for that panel */
  activeByPanel: Record<string, string>;
  /** Most recently activated session, for panel-agnostic consumers. */
  lastActiveSessionId: string | null;
  defaultShell: string;
  shellResolved: boolean;
  fontSize: number;
  fontFamily: string;
  fontId: string;
  scrollback: number;
  aiSuggestions: boolean;
  /** sessionId -> timestamp of last PTY output, for the tab activity dot */
  activity: Record<string, number>;
}

interface TerminalActions {
  addSession: (session: Omit<TerminalSession, "ptyId">) => void;
  addRunSession: (processId: string, name: string, command: string, panelId?: string) => void;
  focusRunSession: (processId: string, panelId?: string) => void;
  ensureInitialSession: (session: Omit<TerminalSession, "ptyId">) => void;
  removeSession: (sessionId: string) => void;
  killSession: (sessionId: string) => Promise<void>;
  killAllSessions: () => Promise<void>;
  reloadSession: (sessionId: string, shell: string) => Promise<void>;
  attachPty: (sessionId: string, ptyId: string) => void;
  setShellResolved: (resolved: boolean) => void;
  setActiveSession: (panelId: string, sessionId: string) => void;
  updateSessionCwd: (sessionId: string, cwd: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  setDefaultShell: (shell: string) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setFontId: (id: string) => void;
  setScrollback: (lines: number) => void;
  setAiSuggestions: (enabled: boolean) => void;
  markActivity: (sessionId: string) => void;
}

const initialState: TerminalState = {
  sessions: [],
  activeByPanel: {},
  lastActiveSessionId: null,
  defaultShell: "",
  shellResolved: false,
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  fontId: "",
  scrollback: 10000,
  aiSuggestions: true,
  activity: {},
};

function activate(
  state: Pick<TerminalState, "activeByPanel">,
  panelId: string | undefined,
  sessionId: string,
): Pick<TerminalState, "activeByPanel" | "lastActiveSessionId"> {
  return {
    activeByPanel: panelId ? { ...state.activeByPanel, [panelId]: sessionId } : state.activeByPanel,
    lastActiveSessionId: sessionId,
  };
}

function withoutSession(state: TerminalState, sessionId: string): Partial<TerminalState> {
  const session = state.sessions.find((s) => s.id === sessionId);
  const sessions = state.sessions.filter((s) => s.id !== sessionId);

  const activeByPanel = { ...state.activeByPanel };
  if (session?.panelId && activeByPanel[session.panelId] === sessionId) {
    const remaining = sessions.filter((s) => s.panelId === session.panelId);
    if (remaining.length > 0) {
      activeByPanel[session.panelId] = remaining[remaining.length - 1].id;
    } else {
      delete activeByPanel[session.panelId];
    }
  }

  const activity = { ...state.activity };
  delete activity[sessionId];

  return {
    sessions,
    activeByPanel,
    activity,
    lastActiveSessionId:
      state.lastActiveSessionId === sessionId
        ? (sessions[sessions.length - 1]?.id ?? null)
        : state.lastActiveSessionId,
  };
}

export const useTerminalStore = create<TerminalState & TerminalActions>(
  crossWindowSync<TerminalState & TerminalActions>("terminal")((set, get) => ({
    ...initialState,

    addSession: (session) => {
      const nextSession: TerminalSession = { ...session };
      set({
        sessions: [...get().sessions, nextSession],
        ...activate(get(), nextSession.panelId, nextSession.id),
      });
    },

    addRunSession: (processId, name, command, panelId) => {
      const { sessions } = get();
      const existing = sessions.find((s) => s.type === "run" && s.processId === processId);
      if (existing) {
        set(activate(get(), existing.panelId ?? panelId, existing.id));
        return;
      }

      const nextSession: TerminalSession = {
        id: crypto.randomUUID(),
        name,
        type: "run",
        command,
        processId,
        panelId,
        isActive: true,
      };
      set({
        sessions: [...sessions, nextSession],
        ...activate(get(), panelId, nextSession.id),
      });
    },

    focusRunSession: (processId, panelId) => {
      const { sessions } = get();
      const existing = sessions.find((s) => s.type === "run" && s.processId === processId);
      if (existing) {
        set(activate(get(), existing.panelId ?? panelId, existing.id));
      }
    },

    ensureInitialSession: (session) => {
      const { sessions } = get();
      if (sessions.some((s) => s.panelId === session.panelId)) return;

      const nextSession: TerminalSession = { ...session };
      set({
        sessions: [...sessions, nextSession],
        ...activate(get(), nextSession.panelId, nextSession.id),
      });
    },

    removeSession: (sessionId) => {
      set((s) => withoutSession(s, sessionId));
    },

    killSession: async (sessionId) => {
      const session = get().sessions.find((s) => s.id === sessionId);

      // Remove the session from React state first so TerminalSession unmounts
      // and disconnects its ResizeObserver before the PTY is destroyed.
      set((s) => withoutSession(s, sessionId));

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
      set({ sessions: [], activeByPanel: {}, lastActiveSessionId: null, activity: {} });
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

    setActiveSession: (panelId, sessionId) => {
      set(activate(get(), panelId, sessionId));
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
    markActivity: (sessionId) => set({ activity: { ...get().activity, [sessionId]: Date.now() } }),
  })),
);
