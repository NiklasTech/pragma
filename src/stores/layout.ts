import { create } from "zustand";

export type SidebarTab = "explorer" | "git" | "mcp" | "ai" | null;

interface LayoutState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarActiveTab: SidebarTab;
  chatPanelOpen: boolean;
  chatPanelWidth: number;
  terminalHeight: number;
  editorHeight: number;
  isFullscreen: boolean;
}

interface LayoutActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarActiveTab: (tab: SidebarTab) => void;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setChatPanelWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  setEditorHeight: (height: number) => void;
  toggleFullscreen: () => void;
}

const initialState: LayoutState = {
  sidebarOpen: true,
  sidebarWidth: 250,
  sidebarActiveTab: "explorer",
  chatPanelOpen: true,
  chatPanelWidth: 380,
  terminalHeight: 50,
  editorHeight: 50,
  isFullscreen: false,
};

export const useLayoutStore = create<LayoutState & LayoutActions>((set, get) => ({
  ...initialState,

  toggleSidebar: () => {
    const { sidebarOpen } = get();
    set({ sidebarOpen: !sidebarOpen });
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  setSidebarActiveTab: (tab) => {
    const { sidebarOpen, sidebarActiveTab } = get();
    if (sidebarActiveTab === tab && sidebarOpen) {
      set({ sidebarOpen: false });
      return;
    }
    set({ sidebarActiveTab: tab, sidebarOpen: true });
  },

  toggleChatPanel: () => {
    const { chatPanelOpen } = get();
    set({ chatPanelOpen: !chatPanelOpen });
  },

  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: width }),
  setTerminalHeight: (height) => set({ terminalHeight: height }),
  setEditorHeight: (height) => set({ editorHeight: height }),
  toggleFullscreen: () => {
    const { isFullscreen } = get();
    set({ isFullscreen: !isFullscreen });
  },
}));
