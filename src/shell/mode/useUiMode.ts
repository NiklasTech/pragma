import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { resolveUiMode, useUiModeStore, type UiMode } from "./store";

export function useUiMode(): UiMode {
  const uiMode = useUiModeStore((state) => state.uiMode);
  const hasRootPath = useFileExplorerStore((state) => state.rootPath !== null);
  return resolveUiMode(uiMode, hasRootPath);
}
