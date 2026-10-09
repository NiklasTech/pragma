import { useEditorStore, type PreviewTab } from "@/shared/stores/editor";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
]);

/// Mirrors the error of `read_text_file` in `src-tauri/src/modules/text_encoding.rs`.
const BINARY_FILE_ERROR = "Binary files are not supported";

export function isImagePath(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export function isBinaryFileError(err: unknown): boolean {
  return String(err) === BINARY_FILE_ERROR;
}

/// Opens or focuses the read-only preview tab of `path`.
export function openPreviewTab(
  path: string,
  previewKind: PreviewTab["previewKind"],
  panelId: string | null,
): void {
  const id = `preview:${path}`;
  const name = path.split(/[\\/]/).pop() ?? path;
  useEditorStore.setState((state) => {
    const activeTabIds = panelId ? { ...state.activeTabIds, [panelId]: id } : state.activeTabIds;
    if (state.tabs.some((tab) => tab.id === id)) {
      return { activeTabId: id, activeTabIds };
    }
    const tab: PreviewTab = { id, kind: "preview", path, name, previewKind };
    return {
      tabs: [...state.tabs, tab],
      tabStates: [...state.tabStates, { tabId: id, cursor: { line: 0, column: 0 }, scrollTop: 0 }],
      activeTabId: id,
      activeTabIds,
    };
  });
}

/// Opens images as previews and other binary files as placeholders; false for text files.
export function openNonTextFile(path: string, panelId: string | null, err?: unknown): boolean {
  if (isImagePath(path)) {
    openPreviewTab(path, "image", panelId);
    return true;
  }
  if (err !== undefined && isBinaryFileError(err)) {
    openPreviewTab(path, "binary", panelId);
    return true;
  }
  return false;
}
