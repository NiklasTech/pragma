import { useMemo } from "react";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useSettingsStore } from "@/shared/stores/settings";
import { useRegisterPaletteCommands } from "./useRegisterPaletteCommands";

export function useRecentFolderPaletteCommand(): void {
  const { selectRoot } = useFileExplorer();

  const commands = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "file.openRecentFolder",
        label: "File: Open Recent Folder...",
        category: "file",
        keywords: ["recent", "folder", "workspace", "project", "open"],
        action: () => {
          const folders = useSettingsStore.getState().workspace.recentFolders;
          useCommandPaletteStore.getState().openPicker({
            placeholder: "Open recent folder...",
            emptyText: "No recent folders.",
            items: folders.map((path) => ({
              id: path,
              label: getWorkspaceName(path),
              detail: path,
            })),
            onSelect: (item) => void selectRoot(item.id),
          });
        },
      },
    ],
    [selectRoot],
  );

  useRegisterPaletteCommands(commands);
}
