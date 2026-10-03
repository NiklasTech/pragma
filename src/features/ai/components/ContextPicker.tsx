import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { Database, FileText, Folder } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { resourceMention, type McpResource } from "@/features/ai/mcp/resources";
import { useMcpCatalog, type McpCatalogEntry } from "@/features/ai/mcp/useMcpCatalog";

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

type PickerItem =
  | { kind: "file"; key: string; entry: DirEntry }
  | { kind: "resource"; key: string; entry: McpCatalogEntry<McpResource> };

interface ActiveMention {
  query: string;
  start: number;
}

export interface ContextPickerRef {
  handleKeyDown: (event: React.KeyboardEvent) => boolean;
}

interface ContextPickerProps {
  input: string;
  onSelect: (value: string, cursorPosition: number) => void;
  cursorPosition: number;
  rootPath: string | null;
}

function getActiveMention(input: string, cursorPosition: number): ActiveMention | null {
  if (cursorPosition === 0) return null;

  let index = cursorPosition - 1;
  while (index >= 0 && !/\s/.test(input[index] ?? "")) {
    if (input[index] === "@") {
      return {
        query: input.slice(index + 1, cursorPosition),
        start: index,
      };
    }
    index -= 1;
  }

  return null;
}

function getRelativePath(rootPath: string, entryPath: string): string {
  const normalizedRoot = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedEntry = entryPath.replace(/\\/g, "/");
  if (normalizedEntry.startsWith(normalizedRoot + "/")) {
    return normalizedEntry.slice(normalizedRoot.length + 1);
  }
  return normalizedEntry;
}

export const ContextPicker = forwardRef<ContextPickerRef, ContextPickerProps>(
  function ContextPicker({ input, onSelect, cursorPosition, rootPath }, ref) {
    const [entries, setEntries] = useState<DirEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mention, setMention] = useState<ActiveMention | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const resources = useMcpCatalog<McpResource>("resources");

    useEffect(() => {
      if (!rootPath) {
        setEntries([]);
        return;
      }

      let cancelled = false;
      void (async () => {
        try {
          const result = await invoke<DirEntry[]>("list_directory_recursive", { path: rootPath });
          if (!cancelled) {
            setEntries(result);
          }
        } catch {}
      })();

      return () => {
        cancelled = true;
      };
    }, [rootPath]);

    useEffect(() => {
      const active = getActiveMention(input, cursorPosition);
      if (active && ((rootPath && entries.length > 0) || resources.length > 0)) {
        setMention(active);
        setOpen(true);
        setSelectedIndex(0);
      } else {
        setMention(null);
        setOpen(false);
      }
    }, [input, cursorPosition, rootPath, entries, resources]);

    const filteredEntries = useMemo<PickerItem[]>(() => {
      if (!mention) return [];
      const query = mention.query.toLowerCase();

      const files = entries
        .filter((entry) => {
          const relativePath = rootPath ? getRelativePath(rootPath, entry.path) : entry.path;
          return (
            relativePath.toLowerCase().includes(query) || entry.name.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          if (a.is_directory && !b.is_directory) return -1;
          if (!a.is_directory && b.is_directory) return 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        })
        .map((entry): PickerItem => ({ kind: "file", key: entry.path, entry }));
      const matchingResources = resources
        .filter(
          (entry) =>
            entry.item.name.toLowerCase().includes(query) ||
            entry.item.uri.toLowerCase().includes(query),
        )
        .map((entry): PickerItem => ({
          kind: "resource",
          key: `${entry.serverId}:${entry.item.uri}`,
          entry,
        }));
      return [...files, ...matchingResources];
    }, [entries, mention, resources, rootPath]);

    const selectEntry = useCallback(
      (item: PickerItem) => {
        if (!mention) return;
        let token: string;
        if (item.kind === "resource") {
          token = resourceMention(item.entry.serverId, item.entry.item.uri);
        } else if (rootPath) {
          token = getRelativePath(rootPath, item.entry.path);
        } else {
          return;
        }

        const before = input.slice(0, mention.start);
        const after = input.slice(cursorPosition);
        const newValue = `${before}@${token} ${after}`;
        const newCursorPosition = mention.start + token.length + 2;

        onSelect(newValue, newCursorPosition);
        setOpen(false);
        setMention(null);
      },
      [input, cursorPosition, mention, rootPath, onSelect],
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (!open || filteredEntries.length === 0) return false;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredEntries.length);
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev === 0 ? filteredEntries.length - 1 : prev - 1));
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          selectEntry(filteredEntries[selectedIndex]);
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          setMention(null);
          return true;
        }

        return false;
      },
      [open, filteredEntries, selectedIndex, selectEntry],
    );

    useImperativeHandle(ref, () => ({
      handleKeyDown,
    }));

    useEffect(() => {
      const selectedItem = itemRefs.current[selectedIndex];
      if (selectedItem && listRef.current) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex]);

    if (!open || filteredEntries.length === 0) return null;

    return (
      <div
        ref={listRef}
        className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-64 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
      >
        {filteredEntries.map((item, index) => {
          const isSelected = index === selectedIndex;
          const label =
            item.kind === "resource"
              ? `${item.entry.serverName}: ${item.entry.item.name}`
              : rootPath
                ? getRelativePath(rootPath, item.entry.path)
                : item.entry.path;

          return (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectEntry(item);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-ui-base outline-hidden select-none",
                isSelected && "bg-bg-active text-fg-default",
              )}
            >
              {item.kind === "resource" ? (
                <Database size={14} className="shrink-0 text-fg-muted" />
              ) : item.entry.is_directory ? (
                <Folder size={14} className="shrink-0 text-fg-muted" />
              ) : (
                <FileText size={14} className="shrink-0 text-fg-muted" />
              )}
              <span
                className="min-w-0 truncate"
                title={item.kind === "resource" ? item.entry.item.uri : undefined}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
