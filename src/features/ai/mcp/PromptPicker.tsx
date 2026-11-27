import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatText, TerminalWindow } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { matchingCommands, type AcpCommand } from "@/features/ai/acp/sessionInfo";
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
  /** Commands and skills of the coding CLI the chat runs, listed before MCP prompts. */
  agentCommands?: AcpCommand[];
}

type PickerItem =
  | { kind: "agent"; command: AcpCommand }
  | { kind: "prompt"; entry: McpCatalogEntry<McpPrompt> };

function itemView(item: PickerItem) {
  if (item.kind === "agent") {
    return {
      key: `agent:${item.command.name}`,
      Icon: TerminalWindow,
      label: `/${item.command.name}`,
      hint: item.command.hint,
      description: item.command.description,
    };
  }
  return {
    key: `${item.entry.serverId}:${item.entry.item.name}`,
    Icon: ChatText,
    label: promptCommand(item.entry.serverName, item.entry.item.name),
    hint: null,
    description: item.entry.item.description,
  };
}

/// The slash command being typed: a leading `/` up to the cursor, without whitespace.
function activeCommand(input: string, cursorPosition: number): string | null {
  if (!input.startsWith("/") || cursorPosition === 0) return null;
  const typed = input.slice(0, cursorPosition);
  return /\s/.test(typed) ? null : typed.slice(1).toLowerCase();
}

const NO_COMMANDS: AcpCommand[] = [];

/// Lists agent commands and MCP prompts as slash commands; MCP prompts get argument placeholders.
export const PromptPicker = forwardRef<PromptPickerRef, PromptPickerProps>(function PromptPicker(
  { input, cursorPosition, onSelect, agentCommands = NO_COMMANDS },
  ref,
) {
  const prompts = useMcpCatalog<McpPrompt>("prompts");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const query = activeCommand(input, cursorPosition);
  const matches = useMemo((): PickerItem[] => {
    if (query === null) return [];
    const commands = matchingCommands(agentCommands, query).map((command): PickerItem => ({
      kind: "agent",
      command,
    }));
    const promptItems = prompts
      .filter((entry) => {
        const command = promptCommand(entry.serverName, entry.item.name).slice(1);
        return command.includes(query) || entry.item.name.toLowerCase().includes(query);
      })
      .map((entry): PickerItem => ({ kind: "prompt", entry }));
    return [...commands, ...promptItems];
  }, [agentCommands, prompts, query]);
  const open = query !== null && query !== dismissed && matches.length > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const select = useCallback(
    (item: PickerItem) => {
      const rest = input.slice(cursorPosition).replace(/^\S*/, "");
      if (item.kind === "agent") {
        const command = `/${item.command.name}`;
        onSelect(`${command}${rest || " "}`, command.length + 1);
        return;
      }
      const template = promptTemplate(item.entry.serverName, item.entry.item);
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
      {matches.map((item, index) => {
        const view = itemView(item);
        return (
          <Button
            variant="ghost"
            key={view.key}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              select(item);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "w-full items-start justify-start gap-2 rounded-[7px] px-2 py-1.5 text-left text-fg-default h-auto whitespace-normal font-normal hover:bg-transparent",
              index === selectedIndex && "bg-bg-active text-fg-default",
            )}
          >
            <view.Icon size={14} className="mt-0.5 shrink-0 text-fg-muted" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-ui-sm">
                {view.label}
                {view.hint && <span className="ml-2 text-fg-subtle">{view.hint}</span>}
              </span>
              {view.description && (
                <span className="truncate text-ui-xs text-fg-subtle">{view.description}</span>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
});
