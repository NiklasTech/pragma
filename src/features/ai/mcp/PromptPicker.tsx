import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatText } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

import { promptCommand, promptTemplate, type McpPrompt } from "./prompts";
import { useMcpCatalog, type McpCatalogEntry } from "./useMcpCatalog";

export interface PromptPickerRef {
  handleKeyDown: (event: React.KeyboardEvent) => boolean;
}

interface PromptPickerProps {
  input: string;
  cursorPosition: number;
  onSelect: (value: string, cursorPosition: number) => void;
}

/// The slash command being typed: a leading `/` up to the cursor, without whitespace.
function activeCommand(input: string, cursorPosition: number): string | null {
  if (!input.startsWith("/") || cursorPosition === 0) return null;
  const typed = input.slice(0, cursorPosition);
  return /\s/.test(typed) ? null : typed.slice(1).toLowerCase();
}

/// Lists MCP prompts as slash commands; choosing one inserts it with argument placeholders.
export const PromptPicker = forwardRef<PromptPickerRef, PromptPickerProps>(function PromptPicker(
  { input, cursorPosition, onSelect },
  ref,
) {
  const prompts = useMcpCatalog<McpPrompt>("prompts");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const query = activeCommand(input, cursorPosition);
  const matches = useMemo(() => {
    if (query === null) return [];
    return prompts.filter((entry) => {
      const command = promptCommand(entry.serverName, entry.item.name).slice(1);
      return command.includes(query) || entry.item.name.toLowerCase().includes(query);
    });
  }, [prompts, query]);
  const open = query !== null && query !== dismissed && matches.length > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const select = useCallback(
    (entry: McpCatalogEntry<McpPrompt>) => {
      const template = promptTemplate(entry.serverName, entry.item);
      const rest = input.slice(cursorPosition).replace(/^\S*/, "");
      const placeholder = template.indexOf('""');
      const cursor = placeholder === -1 ? template.length + 1 : placeholder + 1;
      onSelect(`${template}${rest || " "}`, cursor);
    },
    [cursorPosition, input, onSelect],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!open) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % matches.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index === 0 ? matches.length - 1 : index - 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        select(matches[selectedIndex]);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(query);
        return true;
      }
      return false;
    },
    [matches, open, query, select, selectedIndex],
  );

  useImperativeHandle(ref, () => ({ handleKeyDown }));

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-64 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
      {matches.map((entry, index) => (
        <button
          key={`${entry.serverId}:${entry.item.name}`}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            select(entry);
          }}
          onMouseEnter={() => setSelectedIndex(index)}
          className={cn(
            "flex w-full items-start gap-2 rounded-[4px] px-2 py-1.5 text-left text-ui-base outline-hidden select-none",
            index === selectedIndex && "bg-bg-active text-fg-default",
          )}
        >
          <ChatText size={14} className="mt-0.5 shrink-0 text-fg-muted" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-ui-sm">
              {promptCommand(entry.serverName, entry.item.name)}
            </span>
            {entry.item.description && (
              <span className="truncate text-ui-xs text-fg-subtle">{entry.item.description}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
});
