import { useId, useMemo, useState, type KeyboardEvent } from "react";

import { useAcpApprovalsStore } from "@/features/ai/acp/acpApprovals";
import { useSpawnApprovalsStore } from "@/features/ai/children/acpSpawn";
import { useAgentStatesStore } from "@/features/ai/state/agentStates";
import { revealPane } from "@/features/ai/panes/paneCommands";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { Input } from "@/shared/components/ui/input";
import { Kbd } from "@/shared/components/ui/kbd";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { useUiMode } from "@/shell/mode";

import { railGroups } from "../railEntries";
import { SessionMark, useSessionIdentity } from "../SessionMark";
import { commandTarget, matchCommands } from "./commandLineLogic";
import { CommandList } from "./CommandList";
import { deliverToSession } from "./delivery";
import { pickQuestion } from "./question";
import { QuestionLine } from "./QuestionLine";

const INPUT_SELECTOR = "[data-command-line-input]";

/// Puts the keyboard into the command line; false when it is not on screen.
export function focusCommandLine(): boolean {
  const target =
    document.querySelector<HTMLElement>(INPUT_SELECTOR) ??
    document.querySelector<HTMLElement>("[data-command-line-choice]");
  if (!target) return false;
  target.focus();
  return true;
}

function KeyHint({ keys, children }: { keys: string; children: string }) {
  return (
    <span className="flex items-center gap-1.25 whitespace-nowrap">
      <Kbd>{keys}</Kbd>
      {children}
    </span>
  );
}

/// One line at the bottom of the window: a message for the focused agent, or "/" for commands.
export function CommandLine() {
  const space = useOpenRepositoriesStore(
    (state) => state.spaces.find((candidate) => candidate.id === state.activeSpaceId) ?? null,
  );
  const trees = useAgentsPanesStore((state) => state.trees);
  const commands = useCommandPaletteStore((state) => state.commands);
  const openOverlay = useOverlayStore((state) => state.open);
  const focusBinding = useSettingsStore((state) => state.shortcuts["view.focusCommandLine"]);
  const inAgents = useUiMode() === "agents";
  const listId = useId();
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(0);
  const acpApprovals = useAcpApprovalsStore((state) => state.bySession);
  const spawnApprovals = useSpawnApprovalsStore((state) => state.bySession);
  const agentStates = useAgentStatesStore((state) => state.entries);
  const question = useMemo(
    () =>
      space
        ? pickQuestion(
            railGroups(space, trees).flatMap((group) => group.entries),
            {
              acp: acpApprovals,
              spawn: spawnApprovals,
              stateOf: (id) => agentStates[id]?.state ?? "idle",
            },
          )
        : null,
    [space, trees, acpApprovals, spawnApprovals, agentStates],
  );
  const questionIdentity = useSessionIdentity(question?.entry.sessionId ?? "");
  // Typing leaves the question until it changes; a new question shows again.
  const questionKey = question
    ? `${question.kind}:${question.entry.sessionId}:${"approval" in question ? question.approval.toolCallId : ""}`
    : null;
  const [typingOver, setTypingOver] = useState<string | null>(null);
  const asking = question !== null && typingOver !== questionKey && value === "";

  const target = useMemo(
    () => (space ? commandTarget(space, trees, inAgents) : null),
    [space, trees, inAgents],
  );
  const identity = useSessionIdentity(target?.sessionId ?? "");
  const session = target ? identity.session : undefined;
  const commandMode = value.startsWith("/");
  const matches = useMemo(
    () => (commandMode ? matchCommands(commands, value.slice(1)) : []),
    [commandMode, commands, value],
  );
  const isMac = getIsMac();

  const reset = () => {
    setValue("");
    setSelected(0);
  };

  const run = (command: CommandPaletteItem) => {
    reset();
    (document.activeElement as HTMLElement | null)?.blur();
    command.action();
  };

  const submit = () => {
    if (commandMode) {
      const command = matches[selected];
      if (command) run(command);
      return;
    }
    const text = value.trim();
    if (!text) {
      if (target && space) revealPane(space.id, target.tabId, target.leafId);
      return;
    }
    if (!session) {
      openOverlay("quickStart", text);
      reset();
      return;
    }
    // A chat sends from its pane, so the pane comes on screen; a terminal is typed into directly.
    if (session.kind !== "terminal" && target && space) {
      revealPane(space.id, target.tabId, target.leafId);
    }
    deliverToSession(session, text);
    reset();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (value) reset();
      else event.currentTarget.blur();
    } else if (commandMode && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setSelected((index) => (index + step + matches.length) % Math.max(matches.length, 1));
    }
  };

  const who = session ? identity.name : null;
  const placeholder = who
    ? `message ${who}, or / for commands`
    : "describe a task to start an agent, or / for commands";

  return (
    <footer
      aria-label="Command line"
      className={cn(
        "relative flex h-9.5 shrink-0 items-center gap-2.5 pr-3 pl-4 font-mono text-ui-2xs text-fg-subtle transition-colors duration-(--motion-base)",
        asking && "bg-accent-subtle shadow-[inset_0_1px_0_var(--color-accent-glow)]",
      )}
    >
      <span aria-hidden="true" className="text-ui-sm font-semibold text-primary">
        {asking ? "?" : "›"}
      </span>
      {asking && question && space ? (
        <QuestionLine
          question={question}
          identity={questionIdentity}
          elsewhere={!inAgents || question.entry.tabId !== space.activeTabId}
          onGo={() => revealPane(space.id, question.entry.tabId, question.entry.leafId)}
          onType={(initial) => {
            setTypingOver(questionKey);
            setValue(initial);
            requestAnimationFrame(() => focusCommandLine());
          }}
        />
      ) : (
        <>
          {session && target && (
            <span
              title={identity.title}
              className="flex h-5.5 max-w-[240px] min-w-0 shrink-0 items-center gap-1.5 rounded-[4px] pr-2 pl-1 text-fg-default ring-1 ring-fg-default/15 ring-inset"
            >
              <SessionMark identity={identity} surface="chrome" />
              <span className="truncate">
                {inAgents ? identity.name : `tab ${target.tabNumber} · ${identity.name}`}
              </span>
            </span>
          )}
          <Input
            data-command-line-input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSelected(0);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (commandMode) reset();
              if (!value) setTypingOver(null);
            }}
            placeholder={placeholder}
            aria-label="Command line"
            role="combobox"
            aria-expanded={commandMode}
            aria-controls={commandMode ? listId : undefined}
            aria-activedescendant={
              commandMode && matches.length > 0 ? `${listId}-${selected}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
            className="h-7 min-w-0 flex-1 px-0 font-mono text-ui-xs ring-0 hover:ring-0 focus-visible:ring-0"
          />
          <span className="hidden items-center gap-3 md:flex">
            {commandMode ? (
              <>
                <KeyHint keys="↑↓">pick</KeyHint>
                <KeyHint keys="⏎">run</KeyHint>
                <KeyHint keys="esc">close</KeyHint>
              </>
            ) : (
              <>
                <KeyHint keys="⏎">{session ? "send" : "start"}</KeyHint>
                <KeyHint keys="/">commands</KeyHint>
                {focusBinding && (
                  <KeyHint keys={formatShortcut(focusBinding, isMac)}>focus</KeyHint>
                )}
              </>
            )}
          </span>
        </>
      )}
      {commandMode && (
        <CommandList
          id={listId}
          commands={matches}
          selected={selected}
          onHover={setSelected}
          onRun={run}
        />
      )}
    </footer>
  );
}
