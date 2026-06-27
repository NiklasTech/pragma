import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { crossWindowSync } from "./sync/crossWindowSync";

export interface CursorPosition {
  line: number;
  column: number;
}

export interface FileTab {
  id: string;
  kind: "file";
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isModified: boolean;
  language?: string;
}

export interface DiffTab {
  id: string;
  kind: "diff";
  path: string;
  name: string;
  original: string;
  modified: string;
  patchText: string;
  staged: boolean;
  sourceTabId?: string;
}

export type EditorTab = FileTab | DiffTab;

export interface TabState {
  tabId: string;
  cursor: CursorPosition;
  scrollTop: number;
  pendingScroll?: CursorPosition | null;
}

interface EditorState {
  tabs: EditorTab[];
  tabStates: TabState[];
  activeTabId: string | null;
  activeTabIds: Record<string, string | null>;
  lastFocusedPanelId: string | null;
  cursorPositions: Record<string, CursorPosition>;
  _hasHydrated: boolean;
}

interface EditorActions {
  openFile: (file: Omit<FileTab, "kind">, panelId?: string | null) => void;
  openDiff: (diff: Omit<DiffTab, "kind" | "name" | "id"> & { id?: string; name?: string }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setPanelActiveTab: (panelId: string, tabId: string | null) => void;
  setLastFocusedPanelId: (panelId: string | null) => void;
  getPanelActiveTabId: (panelId: string | null) => string | null;
  updateFileContent: (tabId: string, content: string) => void;
  setCursorPosition: (tabId: string, cursor: CursorPosition) => void;
  goToPosition: (tabId: string, position: CursorPosition | null) => void;
  markModified: (tabId: string, isModified: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  markHydrated: () => void;
}

const STORAGE_KEY = "pragma.editor.v1";

const initialState: EditorState = {
  tabs: [],
  tabStates: [],
  activeTabId: null,
  activeTabIds: {},
  lastFocusedPanelId: null,
  cursorPositions: {},
  _hasHydrated: false,
};

function createTabState(tabId: string): TabState {
  return {
    tabId,
    cursor: { line: 0, column: 0 },
    scrollTop: 0,
  };
}

function isFileTab(tab: EditorTab): tab is FileTab {
  return tab.kind === "file";
}

function stripFileContent(tabs: EditorTab[]): EditorTab[] {
  return tabs.map((tab) =>
    isFileTab(tab) ? { ...tab, content: "", originalContent: "", isModified: false } : tab,
  );
}

const editorStoreCreator: StateCreator<EditorState & EditorActions> = (set, get) => ({
  ...initialState,

  openFile: (file, panelId) => {
    const { tabs, tabStates, activeTabIds } = get();
    const existing = tabs.find((t) => t.id === file.id);
    if (existing) {
      set({
        activeTabId: file.id,
        activeTabIds: panelId ? { ...activeTabIds, [panelId]: file.id } : activeTabIds,
      });
      return;
    }
    const fileTab: FileTab = {
      ...file,
      kind: "file",
      originalContent: file.originalContent ?? file.content,
    };
    set({
      tabs: [...tabs, fileTab],
      tabStates: [...tabStates, createTabState(file.id)],
      activeTabId: file.id,
      activeTabIds: panelId ? { ...activeTabIds, [panelId]: file.id } : activeTabIds,
    });
  },

  openDiff: (diff) => {
    const { tabs, tabStates, activeTabId } = get();
    const diffId = diff.id ?? `diff:${diff.path}:${diff.staged ? "staged" : "unstaged"}`;

    if (tabs.some((t) => t.id === diffId)) {
      if (activeTabId !== diffId) {
        set({ activeTabId: diffId });
      }
      return;
    }

    const fileName = diff.path.split("/").pop() ?? diff.path;
    const diffTab: DiffTab = {
      ...diff,
      id: diffId,
      kind: "diff",
      name: diff.name ?? `${fileName} (Diff)`,
    };

    set({
      tabs: [...tabs, diffTab],
      tabStates: [...tabStates, createTabState(diffId)],
      activeTabId: diffId,
    });
  },

  closeTab: (tabId) => {
    const { tabs, tabStates, activeTabId, activeTabIds } = get();
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    const nextStates = tabStates.filter((s) => s.tabId !== tabId);
    let nextActive =
      activeTabId === tabId
        ? nextTabs.length > 0
          ? nextTabs[nextTabs.length - 1].id
          : null
        : activeTabId;
    const nextActiveTabIds: Record<string, string | null> = {};
    for (const [panelId, id] of Object.entries(activeTabIds)) {
      nextActiveTabIds[panelId] =
        id === tabId ? (nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null) : id;
    }
    set({
      tabs: nextTabs,
      tabStates: nextStates,
      activeTabId: nextActive,
      activeTabIds: nextActiveTabIds,
    });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  setPanelActiveTab: (panelId, tabId) => {
    const { activeTabIds } = get();
    set({ activeTabIds: { ...activeTabIds, [panelId]: tabId } });
  },

  setLastFocusedPanelId: (panelId) => {
    set({ lastFocusedPanelId: panelId });
  },

  getPanelActiveTabId: (panelId) => {
    const { tabs, activeTabId, activeTabIds } = get();
    if (!panelId) return activeTabId;
    const panelActive = activeTabIds[panelId];
    if (panelActive && tabs.some((t) => t.id === panelActive)) return panelActive;
    if (activeTabId && tabs.some((t) => t.id === activeTabId)) return activeTabId;
    return tabs[0]?.id ?? null;
  },

  updateFileContent: (tabId, content) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === tabId && t.kind === "file"
          ? { ...t, content, isModified: content !== t.originalContent }
          : t,
      ),
    });
  },

  setCursorPosition: (tabId, cursor) => {
    const { cursorPositions, tabStates } = get();
    set({
      cursorPositions: { ...cursorPositions, [tabId]: cursor },
      tabStates: tabStates.map((s) => (s.tabId === tabId ? { ...s, cursor } : s)),
    });
  },

  goToPosition: (tabId, position) => {
    const { tabStates } = get();
    set({
      tabStates: tabStates.map((s) => (s.tabId === tabId ? { ...s, pendingScroll: position } : s)),
    });
  },

  markModified: (tabId, isModified) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === tabId && t.kind === "file"
          ? { ...t, isModified, originalContent: isModified ? t.originalContent : t.content }
          : t,
      ),
    });
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs, tabStates } = get();
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= tabs.length ||
      toIndex >= tabs.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const nextTabs = [...tabs];
    const [movedTab] = nextTabs.splice(fromIndex, 1);
    nextTabs.splice(toIndex, 0, movedTab);

    const nextStates = [...tabStates];
    const fromStateIndex = tabStates.findIndex((s) => s.tabId === tabs[fromIndex].id);
    const toStateIndex = tabStates.findIndex((s) => s.tabId === tabs[toIndex].id);
    if (fromStateIndex !== -1 && toStateIndex !== -1) {
      const [movedState] = nextStates.splice(fromStateIndex, 1);
      nextStates.splice(toStateIndex, 0, movedState);
    }

    set({ tabs: nextTabs, tabStates: nextStates });
  },

  markHydrated: () => set({ _hasHydrated: true }),
});

export const useEditorStore = create<EditorState & EditorActions>()(
  persist(crossWindowSync<EditorState & EditorActions>("editor")(editorStoreCreator), {
    name: STORAGE_KEY,
    partialize: (state) => ({
      tabs: stripFileContent(state.tabs),
      tabStates: state.tabStates,
      activeTabId: state.activeTabId,
      activeTabIds: state.activeTabIds,
      lastFocusedPanelId: state.lastFocusedPanelId,
      cursorPositions: state.cursorPositions,
    }),
    onRehydrateStorage: () => (state) => {
      if (!state) return;
      state.markHydrated();
    },
    merge: (persistedState, currentState) => {
      const persisted = persistedState as Partial<EditorState>;
      return {
        ...currentState,
        ...persisted,
        _hasHydrated: false,
      };
    },
  }),
);
