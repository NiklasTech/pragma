import { create } from "zustand";

export interface TerminalSession {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  isActive: boolean;
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
  addSession: (session: TerminalSession) => void;
  removeSession: (sessionId: string) => void;
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
  defaultShell: "/bin/zsh",
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  scrollback: 10000,
  aiSuggestions: true,
};

export const useTerminalStore = create<TerminalState & TerminalActions>((set, get) => ({
  ...initialState,

  addSession: (session) => {
    const { sessions } = get();
    set({
      sessions: [...sessions, session],
      activeSessionId: session.id,
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
}));
