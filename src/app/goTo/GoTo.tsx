import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { BracketsAngle, FileText, Lightning, TextAlignLeft } from "@phosphor-icons/react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { Kbd } from "@/shared/components/ui/kbd";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useAIStore } from "@/shared/stores/ai";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import { useOverlayOpen, useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { focusAttentionSession } from "@/features/ai/notifications/focusSession";
import { sessionAgentManifest } from "@/features/ai/sessions/sessionAgent";
import { compareAgentStates, useAgentStatesStore } from "@/features/ai/state/agentStates";
import { isGeneratedTerminalTitle } from "@/features/ai/terminal/title";
import { symbolKindName } from "@/features/editor/lsp/symbols";

import { rankFiles } from "../goToFileSearch";
import { useGoToFile } from "../useGoToFile";
import { openGoToPath } from "./goToOpen";
import { AgentPreview, CommandPreview, FilePreview } from "./GoToPreview";
import {
  GROUP_LIMITS,
  highlightParts,
  parseGoToQuery,
  rankByLabel,
  type GoToScope,
} from "./goToQuery";
import { useGoToSymbols, useGoToText } from "./useGoToSearches";

type GoToItem =
  | { kind: "file"; key: string; path: string; name: string; detail: string }
  | {
      kind: "symbol";
      key: string;
      name: string;
      detail: string;
      path: string;
      line: number;
      column: number;
    }
  | { kind: "agent"; key: string; sessionId: string; title: string; agentId?: string; name: string }
  | { kind: "command"; key: string; command: CommandPaletteItem }
  | {
      kind: "text";
      key: string;
      path: string;
      line: number;
      column: number;
      preview: string;
      detail: string;
    };

interface GoToGroup {
  heading: string;
  items: GoToItem[];
}

function relative(rootPath: string | null, path: string): string {
  return rootPath && path.startsWith(`${rootPath}/`) ? path.slice(rootPath.length + 1) : path;
}

function Highlighted({ label, text }: { label: string; text: string }) {
  const parts = highlightParts(label, text);
  return (
    <span className="min-w-0 truncate">
      {parts.before}
      {parts.match && (
        <span className="font-semibold text-fg-default underline decoration-fg-subtle underline-offset-3">
          {parts.match}
        </span>
      )}
      {parts.after}
    </span>
  );
}

function Row({ icon, children, end }: { icon: ReactNode; children: ReactNode; end?: ReactNode }) {
  return (
    <>
      <span className="flex w-4.5 shrink-0 justify-center text-fg-subtle">{icon}</span>
      {children}
      {end && (
        <span
          data-slot="command-shortcut"
          className="ml-auto max-w-[45%] shrink-0 truncate pl-3 text-ui-xs text-fg-subtle"
        >
          {end}
        </span>
      )}
    </>
  );
}

const ICON = 14;

function shows(scope: GoToScope, group: GoToScope): boolean {
  return scope === "all" || scope === group;
}

/// One field for files, symbols, agents, commands and text, with a preview of the highlighted result.
export function GoTo() {
  useGoToFile();
  const isOpen = useOverlayOpen("goTo");
  const closeOverlay = useOverlayStore((state) => state.close);
  const close = () => closeOverlay("goTo");
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const files = useGoToFileStore((state) => state.files);
  const filesLoading = useGoToFileStore((state) => state.isLoading);
  const commands = useCommandPaletteStore((state) => state.commands);
  const sessions = useAIStore((state) => state.chatSessions);
  const manifests = useAIStore((state) => state.cliManifests);
  const agentStates = useAgentStatesStore((state) => state.entries);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const isMac = getIsMac();

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState("");
  const deferred = useDeferredValue(query);
  const { scope, text } = parseGoToQuery(deferred);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const symbols = useGoToSymbols(text, isOpen && shows(scope, "symbols"));
  const textSearch = useGoToText(text, isOpen && scope === "all", rootPath);

  const groups = useMemo<GoToGroup[]>(() => {
    const show = (group: GoToScope) => shows(scope, group);
    const limit = (group: keyof typeof GROUP_LIMITS.all) =>
      scope === "all" ? GROUP_LIMITS.all[group] : GROUP_LIMITS.focused;
    const result: GoToGroup[] = [];
    if (show("symbols") && symbols.length > 0) {
      result.push({
        heading: "Symbols",
        items: symbols.slice(0, limit("symbols")).map((symbol, index) => ({
          kind: "symbol",
          key: `symbol:${index}:${symbol.location.filePath}:${symbol.location.range.start.line}`,
          name: `${symbolKindName(symbol.kind)} ${symbol.name}`,
          detail: `${getWorkspaceName(symbol.location.filePath)}:${symbol.location.range.start.line + 1}`,
          path: symbol.location.filePath,
          line: symbol.location.range.start.line + 1,
          column: symbol.location.range.start.character + 1,
        })),
      });
    }
    if (scope === "all") {
      const found = rankFiles(files, text, limit("files"));
      if (found.length > 0) {
        result.push({
          heading: "Files",
          items: found.map((file) => ({
            kind: "file",
            key: `file:${file.path}`,
            path: file.path,
            name: file.name,
            detail: file.relativePath === file.name ? "" : file.relativePath,
          })),
        });
      }
    }
    if (show("agents")) {
      const agents = sessions
        .filter((session) => !session.archived)
        .map((session) => {
          const manifest = sessionAgentManifest(useAIStore.getState(), session.id);
          const name = manifest?.name ?? "Pragma";
          const title =
            manifest && isGeneratedTerminalTitle(session.title, manifest.name)
              ? name
              : session.title;
          return { session, manifest, name, title };
        })
        .sort(
          (a, b) =>
            compareAgentStates(
              agentStates[a.session.id]?.state ?? "idle",
              agentStates[b.session.id]?.state ?? "idle",
            ) || b.session.updatedAt - a.session.updatedAt,
        );
      const ranked = rankByLabel(agents, text, (agent) => agent.title, limit("agents"));
      if (ranked.length > 0) {
        result.push({
          heading: "Agents",
          items: ranked.map((agent) => ({
            kind: "agent",
            key: `agent:${agent.session.id}`,
            sessionId: agent.session.id,
            title: agent.title,
            agentId: agent.manifest?.id,
            name: agent.name,
          })),
        });
      }
    }
    if (show("commands") && (text || scope === "commands")) {
      const ranked = rankByLabel(commands, text, (command) => command.label, limit("commands"));
      if (ranked.length > 0) {
        result.push({
          heading: "Commands",
          items: ranked.map((command) => ({
            kind: "command",
            key: `command:${command.id}`,
            command,
          })),
        });
      }
    }
    if (scope === "all" && textSearch.matches.length > 0) {
      result.push({
        heading: "Text in files",
        items: textSearch.matches.slice(0, limit("text")).map((match, index) => ({
          kind: "text",
          key: `text:${index}:${match.path}:${match.line}`,
          path: match.path,
          line: match.line,
          column: match.column,
          preview: match.preview.trim(),
          detail: `${getWorkspaceName(match.path)}:${match.line}`,
        })),
      });
    }
    return result;
  }, [scope, text, symbols, files, sessions, manifests, agentStates, commands, textSearch.matches]);

  const items = groups.flatMap((group) => group.items);
  const selected = items.find((item) => item.key === highlighted) ?? items[0] ?? null;

  const activate = (item: GoToItem, newPane: boolean) => {
    close();
    if (item.kind === "file") void openGoToPath(item.path, { newPane });
    else if (item.kind === "symbol" || item.kind === "text") {
      void openGoToPath(item.path, {
        newPane,
        position: { line: item.line, column: item.column },
      });
    } else if (item.kind === "agent") focusAttentionSession(item.sessionId);
    else item.command.action();
  };

  const emptyText = filesLoading
    ? "Loading files…"
    : textSearch.searching
      ? "Searching…"
      : "Nothing found.";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className="top-[10%] bottom-auto my-0 flex h-[560px] max-h-[calc(100%-4rem)] w-[880px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(880px,calc(100%-2rem))]"
      >
        <DialogTitle className="sr-only">Go to</DialogTitle>
        <Command
          shouldFilter={false}
          value={selected?.key ?? ""}
          onValueChange={setHighlighted}
          className="min-h-0 flex-1 bg-transparent"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && selected) {
              event.preventDefault();
              activate(selected, true);
            }
          }}
        >
          <CommandInput
            placeholder="Files, symbols, agents, commands"
            value={query}
            onValueChange={setQuery}
            className="text-[15px]"
          />
          <div className="flex min-h-0 flex-1">
            <CommandList className="max-h-none w-[450px] shrink-0 border-r border-border-subtle">
              {items.length === 0 && (
                <p className="px-3 py-6 text-center text-ui-sm text-fg-subtle">{emptyText}</p>
              )}
              {groups.map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.key}
                      value={item.key}
                      onSelect={() => activate(item, false)}
                      className="h-9 gap-2.5"
                    >
                      {item.kind === "file" && (
                        <Row
                          icon={
                            <img
                              src={getFileIconPath(item.name)}
                              alt=""
                              className="size-3.5 object-contain"
                            />
                          }
                          end={item.detail}
                        >
                          <Highlighted label={item.name} text={text} />
                        </Row>
                      )}
                      {item.kind === "symbol" && (
                        <Row icon={<BracketsAngle size={ICON} />} end={item.detail}>
                          <span className="min-w-0 truncate font-mono text-ui-xs">
                            <Highlighted label={item.name} text={text} />
                          </span>
                        </Row>
                      )}
                      {item.kind === "agent" && (
                        <Row
                          icon={
                            item.agentId ? (
                              <AgentMark agentId={item.agentId} name={item.name} size="sm" />
                            ) : (
                              <PragmaMark variant="compact" className="size-3.75" />
                            )
                          }
                          end={item.name}
                        >
                          <Highlighted label={item.title} text={text} />
                        </Row>
                      )}
                      {item.kind === "command" && (
                        <Row
                          icon={<Lightning size={ICON} />}
                          end={
                            item.command.shortcut && shortcuts[item.command.shortcut]
                              ? formatShortcut(shortcuts[item.command.shortcut], isMac)
                              : undefined
                          }
                        >
                          <Highlighted label={item.command.label} text={text} />
                        </Row>
                      )}
                      {item.kind === "text" && (
                        <Row icon={<TextAlignLeft size={ICON} />} end={item.detail}>
                          <span className="min-w-0 truncate font-mono text-ui-xs">
                            <Highlighted label={item.preview} text={text} />
                          </span>
                        </Row>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <div className="flex min-w-0 flex-1 flex-col bg-bg-well" aria-live="polite">
              {selected?.kind === "file" && (
                <FilePreview path={selected.path} label={relative(rootPath, selected.path)} />
              )}
              {(selected?.kind === "symbol" || selected?.kind === "text") && (
                <FilePreview
                  path={selected.path}
                  label={relative(rootPath, selected.path)}
                  line={selected.line}
                />
              )}
              {selected?.kind === "agent" && (
                <AgentPreview sessionId={selected.sessionId} onDone={close} />
              )}
              {selected?.kind === "command" && <CommandPreview command={selected.command} />}
              {!selected && (
                <div className="flex flex-1 items-center justify-center text-fg-subtle">
                  <FileText size={20} aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
          <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-border-subtle px-4 text-ui-xs text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <Kbd>↑↓</Kbd>move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>⏎</Kbd>open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>{isMac ? "⌘⏎" : "Ctrl+⏎"}</Kbd>open in a new pane
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Kbd>&gt;</Kbd>commands
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>@</Kbd>symbols
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>#</Kbd>agents
            </span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
