import { create } from "zustand";

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  isModified: boolean;
  language?: string;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface TabState {
  fileId: string;
  cursor: CursorPosition;
  scrollTop: number;
}

interface EditorState {
  openFiles: OpenFile[];
  openTabs: TabState[];
  activeTabId: string | null;
  cursorPositions: Record<string, CursorPosition>;
}

interface EditorActions {
  openFile: (file: OpenFile) => void;
  closeFile: (fileId: string) => void;
  setActiveTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  setCursorPosition: (fileId: string, cursor: CursorPosition) => void;
  markModified: (fileId: string, isModified: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

const initialState: EditorState = {
  openFiles: [],
  openTabs: [],
  activeTabId: null,
  cursorPositions: {},
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  openFile: (file) => {
    const { openFiles, openTabs, activeTabId } = get();
    if (openFiles.some((f) => f.id === file.id)) {
      if (activeTabId !== file.id) {
        set({ activeTabId: file.id });
      }
      return;
    }
    const newTab: TabState = {
      fileId: file.id,
      cursor: { line: 0, column: 0 },
      scrollTop: 0,
    };
    set({
      openFiles: [...openFiles, file],
      openTabs: [...openTabs, newTab],
      activeTabId: file.id,
    });
  },

  closeFile: (fileId) => {
    const { openFiles, openTabs, activeTabId } = get();
    const nextFiles = openFiles.filter((f) => f.id !== fileId);
    const nextTabs = openTabs.filter((t) => t.fileId !== fileId);
    let nextActive = activeTabId;
    if (activeTabId === fileId) {
      nextActive = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].fileId : null;
    }
    set({
      openFiles: nextFiles,
      openTabs: nextTabs,
      activeTabId: nextActive,
    });
  },

  setActiveTab: (fileId) => {
    set({ activeTabId: fileId });
  },

  updateFileContent: (fileId, content) => {
    const { openFiles } = get();
    set({
      openFiles: openFiles.map((f) => (f.id === fileId ? { ...f, content, isModified: true } : f)),
    });
  },

  setCursorPosition: (fileId, cursor) => {
    const { cursorPositions, openTabs } = get();
    set({
      cursorPositions: { ...cursorPositions, [fileId]: cursor },
      openTabs: openTabs.map((t) => (t.fileId === fileId ? { ...t, cursor } : t)),
    });
  },

  markModified: (fileId, isModified) => {
    const { openFiles } = get();
    set({
      openFiles: openFiles.map((f) => (f.id === fileId ? { ...f, isModified } : f)),
    });
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { openFiles, openTabs } = get();
    if (
      fromIndex < 0 ||
      fromIndex >= openFiles.length ||
      toIndex < 0 ||
      toIndex >= openFiles.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const nextFiles = [...openFiles];
    const nextTabs = [...openTabs];
    const [movedFile] = nextFiles.splice(fromIndex, 1);
    const [movedTab] = nextTabs.splice(fromIndex, 1);
    nextFiles.splice(toIndex, 0, movedFile);
    nextTabs.splice(toIndex, 0, movedTab);
    set({ openFiles: nextFiles, openTabs: nextTabs });
  },
}));
