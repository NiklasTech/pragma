import { useMemo } from "react";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useCloseRepository } from "@/shared/hooks/useOpenRepositories";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useRegisterPaletteCommands } from "./useRegisterPaletteCommands";

function repositoryItems(paths: string[]) {
  return paths.map((path) => ({ id: path, label: getWorkspaceName(path), detail: path }));
}

export function useRepositoryPaletteCommands(): void {
  const { selectRoot } = useFileExplorer();
  const closeRepository = useCloseRepository();

  const commands = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "file.addRepository",
        label: "File: Add Repository...",
        category: "file",
        keywords: ["repository", "folder", "workspace", "project", "open", "add"],
        action: () => void selectRoot(),
      },
      {
        id: "file.switchRepository",
        label: "File: Switch Repository...",
        category: "file",
        keywords: ["repository", "folder", "workspace", "project", "switch", "activate"],
        action: () => {
          const { paths, activePath } = useOpenRepositoriesStore.getState();
          useCommandPaletteStore.getState().openPicker({
            placeholder: "Switch to repository...",
            emptyText: "No open repositories.",
            items: repositoryItems(paths),
            initialItemId: activePath ?? undefined,
            onSelect: (item) => void selectRoot(item.id),
          });
        },
      },
      {
        id: "file.closeRepository",
        label: "File: Close Repository...",
        category: "file",
        keywords: ["repository", "folder", "workspace", "project", "close", "remove"],
        action: () => {
          const { paths, activePath } = useOpenRepositoriesStore.getState();
          useCommandPaletteStore.getState().openPicker({
            placeholder: "Close repository...",
            emptyText: "No open repositories.",
            items: repositoryItems(paths),
            initialItemId: activePath ?? undefined,
            onSelect: (item) => void closeRepository(item.id),
          });
        },
      },
    ],
    [closeRepository, selectRoot],
  );

  useRegisterPaletteCommands(commands);
}
