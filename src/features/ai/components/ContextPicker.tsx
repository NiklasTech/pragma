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
import { FileText, Folder } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

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
      if (active && rootPath && entries.length > 0) {
        setMention(active);
        setOpen(true);
        setSelectedIndex(0);
      } else {
        setMention(null);
        setOpen(false);
      }
    }, [input, cursorPosition, rootPath, entries]);

    const filteredEntries = useMemo(() => {
      if (!mention) return [];
      const query = mention.query.toLowerCase();

      return entries
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
        });
    }, [entries, mention, rootPath]);

    const selectEntry = useCallback(
      (entry: DirEntry) => {
        if (!mention || !rootPath) return;

        const relativePath = getRelativePath(rootPath, entry.path);
        const before = input.slice(0, mention.start);
        const after = input.slice(cursorPosition);
        const newValue = `${before}@${relativePath} ${after}`;
        const newCursorPosition = mention.start + relativePath.length + 2;

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
        className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-64 overflow-auto rounded-sm border border-border bg-popover p-1 shadow-lg"
      >
        {filteredEntries.map((entry, index) => {
          const relativePath = rootPath ? getRelativePath(rootPath, entry.path) : entry.path;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={entry.path}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectEntry(entry);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-ui-base outline-none select-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]",
                isSelected && "bg-bg-active text-fg-default",
              )}
            >
              {entry.is_directory ? (
                <Folder size={14} className="shrink-0 text-fg-muted" />
              ) : (
                <FileText size={14} className="shrink-0 text-fg-muted" />
              )}
              <span className="min-w-0 truncate">{relativePath}</span>
            </button>
          );
        })}
      </div>
    );
  },
);
