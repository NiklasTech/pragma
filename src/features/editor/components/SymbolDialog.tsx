import { useEffect, useState } from "react";
import { Function as FunctionIcon } from "@phosphor-icons/react";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { useEditorStore } from "@/shared/stores/editor";
import { navigateToLocation } from "@/features/editor/lsp/definition";
import {
  queryWorkspaceSymbols,
  symbolKindName,
  useSymbolDialogStore,
} from "@/features/editor/lsp/symbols";
import type { LspDocumentSymbolItem, LspWorkspaceSymbolItem } from "@/features/editor/lsp/client";

export function SymbolDialog() {
  const mode = useSymbolDialogStore((state) => state.mode);
  const language = useSymbolDialogStore((state) => state.language);
  const filePath = useSymbolDialogStore((state) => state.filePath);
  const documentItems = useSymbolDialogStore((state) => state.documentItems);
  const close = useSymbolDialogStore((state) => state.close);

  const [query, setQuery] = useState("");
  const [workspaceItems, setWorkspaceItems] = useState<LspWorkspaceSymbolItem[]>([]);

  useEffect(() => {
    if (mode !== "workspace") {
      setQuery("");
      setWorkspaceItems([]);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "workspace") {
      return;
    }
    const timer = setTimeout(() => {
      void queryWorkspaceSymbols(language, filePath, query).then(setWorkspaceItems);
    }, 200);
    return () => clearTimeout(timer);
  }, [mode, query, language, filePath]);

  const selectDocumentSymbol = (item: LspDocumentSymbolItem) => {
    close();
    const store = useEditorStore.getState();
    const tab = store.tabs.find((t) => t.kind === "file" && t.path === filePath);
    if (tab) {
      store.setActiveTab(tab.id);
      store.goToPosition(tab.id, {
        line: item.range.start.line + 1,
        column: item.range.start.character + 1,
      });
    }
  };

  const selectWorkspaceSymbol = (item: LspWorkspaceSymbolItem) => {
    close();
    void navigateToLocation({
      filePath: item.location.filePath,
      line: item.location.range.start.line,
      character: item.location.range.start.character,
    });
  };

  const isDocument = mode === "document";

  return (
    <CommandDialog
      open={mode !== null}
      onOpenChange={(open) => !open && close()}
      className="sm:max-w-xl"
      title={isDocument ? "Go to Symbol in Editor" : "Go to Symbol in Workspace"}
      description={isDocument ? "Symbols in the current file" : "Search symbols in the workspace"}
    >
      <CommandInput
        placeholder={isDocument ? "Filter symbols..." : "Search workspace symbols..."}
        value={isDocument ? undefined : query}
        onValueChange={isDocument ? undefined : setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <span>{isDocument ? "No symbols in this file." : "No symbols found."}</span>
        </CommandEmpty>
        {isDocument
          ? documentItems.map((item, index) => (
              <CommandItem
                key={`${item.name}:${item.range.start.line}:${index}`}
                value={`${item.name}:${index}`}
                keywords={[item.name, item.containerName ?? "", item.detail ?? ""]}
                onSelect={() => selectDocumentSymbol(item)}
              >
                <FunctionIcon size={14} className="shrink-0 text-fg-muted" />
                <span
                  className="truncate text-ui-sm text-fg-default"
                  style={{ paddingLeft: `${item.depth * 12}px` }}
                >
                  {item.name}
                </span>
                {item.detail && (
                  <span className="truncate text-ui-xs text-fg-muted">{item.detail}</span>
                )}
                <span className="ml-auto rounded bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-subtle">
                  {symbolKindName(item.kind)}
                </span>
              </CommandItem>
            ))
          : workspaceItems.map((item, index) => (
              <CommandItem
                key={`${item.name}:${item.location.filePath}:${index}`}
                value={`${item.name}:${index}`}
                keywords={[item.name, item.containerName ?? "", item.location.filePath]}
                onSelect={() => selectWorkspaceSymbol(item)}
              >
                <FunctionIcon size={14} className="shrink-0 text-fg-muted" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ui-sm text-fg-default">{item.name}</span>
                  <span className="truncate text-ui-xs text-fg-muted">
                    {item.location.filePath}
                  </span>
                </div>
                <span className="rounded bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-subtle">
                  {symbolKindName(item.kind)}
                </span>
              </CommandItem>
            ))}
      </CommandList>
    </CommandDialog>
  );
}
