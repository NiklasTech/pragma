import { useShallow } from "zustand/react/shallow";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
import { useEditorStore } from "@/shared/stores/editor";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { detectLanguage } from "@/shared/lib/language";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { useGoToFile } from "./useGoToFile";
import { rankFiles } from "./goToFileSearch";
import { openNonTextFile } from "@/features/editor/preview/openPreview";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
  encoding: string;
}

// Rendering every file of a large folder freezes the dialog, so only the best matches are shown.
const MAX_RESULTS = 100;

export function GoToFile() {
  useGoToFile();

  const isOpen = useGoToFileStore((state) => state.isOpen);
  const close = useGoToFileStore((state) => state.close);
  const files = useGoToFileStore((state) => state.files);
  const isLoading = useGoToFileStore((state) => state.isLoading);
  const error = useGoToFileStore((state) => state.error);
  const editorPanelId = useEditorPanelId();
  const { openFile } = useEditorStore(useShallow((s) => ({ openFile: s.openFile })));

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => rankFiles(files, deferredQuery, MAX_RESULTS),
    [files, deferredQuery],
  );

  // The shortcut can also close the dialog, so the query resets on every close.
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  async function handleSelect(path: string) {
    close();
    if (openNonTextFile(path, editorPanelId)) return;

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
          encoding: result.encoding,
        },
        editorPanelId,
      );
    } catch (err) {
      if (openNonTextFile(path, editorPanelId, err)) return;
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
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput placeholder="Search files..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2">
            <SmileySad className="size-6 text-fg-muted" />
            <span>{emptyMessage}</span>
          </div>
        </CommandEmpty>
        {results.map((file) => {
          const { relativePath } = file;
          return (
            <CommandItem key={file.path} value={file.path} onSelect={() => handleSelect(file.path)}>
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
