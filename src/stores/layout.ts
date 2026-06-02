import { create } from "zustand";

interface LayoutState {
  sidebarWidth: number;
  aiPanelWidth: number;
  editorHeight: number;
  terminalHeight: number;
  sidebarTab: "explorer" | "search" | "git";
  setSidebarWidth: (width: number) => void;
  setAIPanelWidth: (width: number) => void;
  setEditorHeight: (height: number) => void;
  setTerminalHeight: (height: number) => void;
  setSidebarTab: (tab: "explorer" | "search" | "git") => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarWidth: 20,
  aiPanelWidth: 25,
  editorHeight: 50,
  terminalHeight: 50,
  sidebarTab: "explorer",
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setAIPanelWidth: (width) => set({ aiPanelWidth: width }),
  setEditorHeight: (height) => set({ editorHeight: height }),
  setTerminalHeight: (height) => set({ terminalHeight: height }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
}));
