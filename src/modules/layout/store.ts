import { create } from "zustand";

// ─── Constants ───────────────────────────────────────────────────────────────

export const SIDEBAR_DEFAULT_WIDTH = 250;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_WIDTH_STORAGE_KEY = "pragma.sidebar.width";
export const SIDEBAR_VIEW_STORAGE_KEY = "pragma.sidebar.view";

export const AI_PANEL_DEFAULT_WIDTH = 380;
export const AI_PANEL_MIN_WIDTH = 280;
export const AI_PANEL_MAX_WIDTH = 600;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function readSidebarWidth(): number {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function readSidebarView(): "explorer" | "search" | "git" | "git-status" {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_VIEW_STORAGE_KEY);
    if (stored === "explorer" || stored === "search" || stored === "git" || stored === "git-status")
      return stored;
  } catch {
    // ignore
  }
  return "explorer";
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface LayoutState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  sidebarTab: "explorer" | "search" | "git" | "git-status";
  editorHeight: number;
  terminalHeight: number;
  aiPanelOpen: boolean;
  aiPanelWidth: number;

  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarTab: (tab: "explorer" | "search" | "git" | "git-status") => void;
  setEditorHeight: (height: number) => void;
  setTerminalHeight: (height: number) => void;
  setAIPanelOpen: (open: boolean) => void;
  setAIPanelWidth: (width: number) => void;
  toggleAIPanel: () => void;
}

let sidebarWidthWriteTimer = 0;
let sidebarViewWriteTimer = 0;

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarWidth: readSidebarWidth(),
  sidebarCollapsed: false,
  sidebarTab: readSidebarView(),
  editorHeight: 50,
  terminalHeight: 50,
  aiPanelOpen: false,
  aiPanelWidth: AI_PANEL_DEFAULT_WIDTH,

  setSidebarWidth: (width) => {
    const clamped = clampSidebarWidth(width);
    set({ sidebarWidth: clamped });

    if (sidebarWidthWriteTimer) window.clearTimeout(sidebarWidthWriteTimer);
    sidebarWidthWriteTimer = window.setTimeout(() => {
      sidebarWidthWriteTimer = 0;
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
      } catch {
        // ignore (private mode)
      }
    }, 200);
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setSidebarTab: (tab) => {
    set({ sidebarTab: tab });

    if (sidebarViewWriteTimer) window.clearTimeout(sidebarViewWriteTimer);
    sidebarViewWriteTimer = window.setTimeout(() => {
      sidebarViewWriteTimer = 0;
      try {
        window.localStorage.setItem(SIDEBAR_VIEW_STORAGE_KEY, tab);
      } catch {
        // ignore
      }
    }, 200);
  },

  setEditorHeight: (height) => set({ editorHeight: height }),
  setTerminalHeight: (height) => set({ terminalHeight: height }),

  setAIPanelOpen: (open) => set({ aiPanelOpen: open }),
  setAIPanelWidth: (width) =>
    set({ aiPanelWidth: Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, width)) }),

  toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
}));
