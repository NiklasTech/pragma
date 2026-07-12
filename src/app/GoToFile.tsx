import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { SmileySad } from "@phosphor-icons/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useEditorStore } from "@/shared/stores/editor";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { detectLanguage } from "@/shared/lib/language";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { useGoToFile } from "./useGoToFile";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

function getRelativePath(path: string, rootPath: string | null): string {
  if (!rootPath) return path;
  if (path.startsWith(rootPath)) {
    const relative = path.slice(rootPath.length);
    return relative.startsWith("/") || relative.startsWith("\\") ? relative.slice(1) : relative;
  }
  return path;
}

export function GoToFile() {
  useGoToFile();

  const isOpen = useGoToFileStore((state) => state.isOpen);
  const close = useGoToFileStore((state) => state.close);
  const files = useGoToFileStore((state) => state.files);
  const isLoading = useGoToFileStore((state) => state.isLoading);
  const error = useGoToFileStore((state) => state.error);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const editorPanelId = useEditorPanelId();
  const { openFile } = useEditorStore();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }, [files]);

  async function handleSelect(path: string) {
    close();

    try {
      const result = await invoke<FileReadResult>("read_text_file", { path });
      openFile(
        {
          id: result.path,
          path: result.path,
          name: result.name,
          content: result.content,
          originalContent: result.content,
          isModified: false,
          language: detectLanguage(result.name),
        },
        editorPanelId,
      );
    } catch (err) {
      toast.error(String(err));
    }
  }

  const emptyMessage = error ?? (isLoading ? "Loading files..." : "No files found.");

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      className="sm:max-w-xl"
      title="Go to File"
      description="Search for a file to open"
    >
      <CommandInput placeholder="Search files..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2">
            <SmileySad className="size-6 text-fg-muted" />
            <span className="text-ui-sm text-fg-muted">{emptyMessage}</span>
          </div>
        </CommandEmpty>
        {sortedFiles.map((file) => {
          const relativePath = getRelativePath(file.path, rootPath);
          const isHovered = hoveredPath === file.path;
          return (
            <CommandItem
              key={file.path}
              value={file.path}
              keywords={[file.name, relativePath]}
              onSelect={() => handleSelect(file.path)}
              onMouseEnter={() => setHoveredPath(file.path)}
              onMouseLeave={() => setHoveredPath(null)}
              className={
                isHovered ? "border-border-focus bg-bg-input animate-command-item-pulse" : undefined
              }
            >
              <img
                src={getFileIconPath(file.name)}
                alt=""
                className="size-4 shrink-0 object-contain"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ui-sm text-fg-default">{file.name}</span>
                {relativePath !== file.name && (
                  <span className="truncate text-ui-xs text-fg-muted">{relativePath}</span>
                )}
              </div>
            </CommandItem>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
