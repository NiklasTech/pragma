import { create } from "zustand";

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
}

interface EditorState {
  tabs: EditorTab[];
  tabStates: TabState[];
  activeTabId: string | null;
  cursorPositions: Record<string, CursorPosition>;
}

interface EditorActions {
  openFile: (file: Omit<FileTab, "kind">) => void;
  openDiff: (diff: Omit<DiffTab, "kind" | "name" | "id"> & { id?: string; name?: string }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateFileContent: (tabId: string, content: string) => void;
  setCursorPosition: (tabId: string, cursor: CursorPosition) => void;
  markModified: (tabId: string, isModified: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

const initialState: EditorState = {
  tabs: [],
  tabStates: [],
  activeTabId: null,
  cursorPositions: {},
};

function createTabState(tabId: string): TabState {
  return {
    tabId,
    cursor: { line: 0, column: 0 },
    scrollTop: 0,
  };
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  openFile: (file) => {
    const { tabs, tabStates, activeTabId } = get();
    if (tabs.some((t) => t.id === file.id)) {
      if (activeTabId !== file.id) {
        set({ activeTabId: file.id });
      }
      return;
    }
    const fileTab: FileTab = { ...file, kind: "file" };
    set({
      tabs: [...tabs, fileTab],
      tabStates: [...tabStates, createTabState(file.id)],
      activeTabId: file.id,
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
    const { tabs, tabStates, activeTabId } = get();
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    const nextStates = tabStates.filter((s) => s.tabId !== tabId);
    let nextActive = activeTabId;
    if (activeTabId === tabId) {
      nextActive = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null;
    }
    set({
      tabs: nextTabs,
      tabStates: nextStates,
      activeTabId: nextActive,
    });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  updateFileContent: (tabId, content) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === tabId && t.kind === "file" ? { ...t, content, isModified: true } : t,
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

  markModified: (tabId, isModified) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) => (t.id === tabId && t.kind === "file" ? { ...t, isModified } : t)),
    });
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs, tabStates } = get();
    if (
      fromIndex < 0 ||
      fromIndex >= tabs.length ||
      toIndex < 0 ||
      toIndex >= tabs.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const nextTabs = [...tabs];
    const nextStates = [...tabStates];
    const [movedTab] = nextTabs.splice(fromIndex, 1);
    const [movedState] = nextStates.splice(fromIndex, 1);
    nextTabs.splice(toIndex, 0, movedTab);
    nextStates.splice(toIndex, 0, movedState);
    set({ tabs: nextTabs, tabStates: nextStates });
  },
}));
