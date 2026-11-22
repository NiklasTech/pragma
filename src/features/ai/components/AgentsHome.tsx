"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MagnifyingGlass, Stack, TerminalWindow } from "@phosphor-icons/react";
import { toast } from "sonner";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useAIStore } from "@/shared/stores/ai";
import { useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { refreshCLIStatuses } from "@/shared/stores/ai/cliRefresh";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";
import { useAgentStore } from "@/features/agent/store";
import { defaultEnvironment } from "@/features/ai/sessions/environment";
import { useRepositorySessions } from "@/features/ai/sessions/repositorySessions";
import { startSession } from "@/features/ai/sessions/start";

import { deliverTerminalPrompt } from "../children/terminalPrompt";
import { isHomePromptSubmitKey, trimHomePrompt } from "../home/homePrompt";
import { startPlacement } from "../home/startPlacement";
import { clearPendingFirstMessage, setPendingFirstMessage } from "../home/pendingFirstMessage";
import {
  pickOnly,
  setMemberCount,
  teamTotal,
  toggleMember,
  type TeamMember,
} from "../home/agentTeam";
import { createTerminalSession, launchTeam } from "../panes/launch";
import { useAgentsPanesStore } from "../panes/store";
import { quickChoices } from "../quickStart/quickChoices";
import { quickAgents, taskTabTitle } from "../quickStart/quickStart";
import { useNewSessionActions } from "../threads/useNewSessionActions";
import { AgentTeamPicker } from "./AgentTeamPicker";
import { ChatToolbar } from "./ChatToolbar";

const CARD =
  "h-auto flex-col items-stretch gap-1.5 rounded-[12px] px-3.5 py-3 text-left text-ui-sm font-normal text-fg-default ring-1 ring-border-subtle ring-inset hover:bg-transparent hover:ring-border";

function homePath(path: string): string {
  return path.replace(/^\/(Users|home)\/[^/]+/, "~");
}

function ActionCard({
  icon,
  shortcut,
  label,
  onClick,
}: {
  icon: ReactNode;
  shortcut?: string | null;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" className={CARD} onClick={onClick}>
      <span className="flex h-5 items-center gap-2 text-fg-subtle">
        {icon}
        {shortcut && <Kbd className="ml-auto">{shortcut}</Kbd>}
      </span>
      {label}
    </Button>
  );
}

/// An empty space: one field for a task, the agent that runs it, and three other ways to start.
export function AgentsHome() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const chatSessions = useRepositorySessions();
  const openSession = useAgentsPanesStore((state) => state.openSession);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const setting = useWorkspaceSettingsStore((state) => state.settings?.agent?.writingSessions);
  const branch = useGitStore((state) => state.snapshot?.repo.branch ?? null);
  const changes = useGitStore((state) => state.snapshot?.changed_files.length ?? null);
  const noGit = useGitStore((state) => !state.snapshot && !state.isLoading && state.error !== null);
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const accounts = useCliAccountsStore((state) => state.accounts);
  const accountNames = useSettingsStore((state) => state.ai.cliAccounts.names);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const openOverlay = useOverlayStore((state) => state.open);
  const actions = useNewSessionActions(rootPath);

  const [prompt, setPrompt] = useState("");
  const [pragmaPicked, setPragmaPicked] = useState(false);
  const [picked, setPicked] = useState<TeamMember[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (manifests.length === 0) void loadCLIManifests();
  }, [loadCLIManifests, manifests.length]);

  useEffect(() => {
    void refreshCLIStatuses();
  }, []);

  const { ready } = useMemo(() => quickAgents(manifests, statuses), [manifests, statuses]);
  const choices = useMemo(
    () => quickChoices(ready, accounts, accountNames),
    [ready, accounts, accountNames],
  );
  const team: TeamMember[] = picked ?? (choices[0] ? [{ agent: choices[0].agent, count: 1 }] : []);
  const pragma = pragmaPicked || team.length === 0;
  const total = teamTotal(team);
  const name = getWorkspaceName(rootPath);
  const several = !pragma && total > 1;
  // Several agents on one task would edit the same files, so each gets a worktree unless the project says otherwise.
  const { groupMode, label: where } = startPlacement({
    several,
    setting,
    noGit,
    single: defaultEnvironment(chatSessions, setting),
  });
  const isMac = getIsMac();
  const facts = rootPath
    ? [
        homePath(rootPath),
        branch,
        changes === null ? null : changes === 0 ? "clean" : `${changes} changed`,
      ].filter((fact): fact is string => Boolean(fact))
    : [];

  const start = async () => {
    if (!rootPath || creating) return;
    setCreating(true);
    const text = trimHomePrompt(prompt);
    try {
      if (pragma) {
        if (text) setPendingFirstMessage(text);
        else clearPendingFirstMessage();
        const session = await startSession(rootPath, {
          init: { kind: agentModeActive ? "agent" : "ask" },
        });
        openSession(rootPath, session.id);
      } else {
        if (several) {
          const task = text ? { title: taskTabTitle(text), prompt: text } : undefined;
          const members = team.flatMap((member) => {
            const manifest = ready.find((item) => item.id === member.agent.manifestId);
            return manifest
              ? [{ manifest, accountDir: member.agent.accountDir, count: member.count }]
              : [];
          });
          await launchTeam(rootPath, members, groupMode, task);
          setPrompt("");
          return;
        }
        const agent = team[0].agent;
        const manifest = ready.find((item) => item.id === agent.manifestId);
        if (!manifest) return;
        const session = await createTerminalSession(rootPath, manifest, {
          title: text ? taskTabTitle(text) : undefined,
          accountDir: agent.accountDir,
        });
        openSession(rootPath, session.id);
        if (text) deliverTerminalPrompt(session.id, text);
      }
      setPrompt("");
    } catch (err) {
      clearPendingFirstMessage();
      toast.error(err instanceof Error ? err.message : "Could not start the session");
    } finally {
      setCreating(false);
    }
  };

  const shortcut = (id: "file.goToFile" | "session.quickStart") => {
    const binding = shortcuts[id];
    return binding ? formatShortcut(binding, isMac) : null;
  };

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-[600px] animate-in flex-col gap-5.5 duration-300 ease-(--motion-ease-out) fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
        <div className="flex items-center gap-3.5">
          {name ? (
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-bg-active text-[19px] font-semibold text-fg-muted"
            >
              {name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <PragmaMark animation="intro" className="size-9 text-fg-default" />
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-fg-default">
              {name || "Open a folder"}
            </h1>
            {facts.length > 0 && (
              <span className="truncate font-mono text-ui-xs text-fg-muted">
                {facts.join(" · ")}
              </span>
            )}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
          className="flex flex-col gap-2.5 rounded-[14px] bg-bg-sheet py-3 pr-3.5 pl-4 shadow-[var(--shadow-sm)] ring-1 ring-border ring-inset transition-shadow duration-(--motion-fast) focus-within:ring-border-focus"
        >
          <Textarea
            autoFocus
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              const withModifier = event.key === "Enter" && (isMac ? event.metaKey : event.ctrlKey);
              if (withModifier || isHomePromptSubmitKey(event)) {
                event.preventDefault();
                void start();
              }
            }}
            rows={1}
            aria-label="Task for the agent"
            placeholder={name ? `What should happen in ${name}?` : "Open a folder to start"}
            disabled={!rootPath}
            className="min-h-0 resize-none bg-transparent px-0 py-0.5 text-ui-lg ring-0 hover:ring-0 focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentTeamPicker
              choices={choices}
              team={team}
              pragma={pragma}
              onPickOnly={(agent) => {
                setPragmaPicked(false);
                setPicked(pickOnly(pragma ? [] : team, agent));
              }}
              onToggle={(agent) => {
                setPragmaPicked(false);
                setPicked(pragma ? pickOnly([], agent) : toggleMember(team, agent));
              }}
              onCount={(agent, count) => setPicked(setMemberCount(team, agent, count))}
              onPickPragma={() => setPragmaPicked(true)}
            />
            {pragma && rootPath && <ChatToolbar />}
            <span className="ml-auto text-ui-xs text-fg-muted">{where}</span>
            <Button type="submit" size="sm" disabled={!rootPath || creating}>
              {creating ? "Starting…" : several ? `Start ${total}` : "Start"}
              <Kbd className="border-0 bg-black/10 text-primary-foreground/70">
                {isMac ? "⌘⏎" : "Ctrl+Enter"}
              </Kbd>
            </Button>
          </div>
        </form>

        {rootPath && (
          <div className="grid grid-cols-3 gap-2">
            <ActionCard
              icon={<TerminalWindow size={15} aria-hidden="true" />}
              label="Open a terminal"
              onClick={() => void actions.startShell()}
            />
            <ActionCard
              icon={<MagnifyingGlass size={15} aria-hidden="true" />}
              shortcut={shortcut("file.goToFile")}
              label="Open a file"
              onClick={() => openOverlay("goTo")}
            />
            <ActionCard
              icon={<Stack size={15} aria-hidden="true" />}
              shortcut={shortcut("session.quickStart")}
              label="Start from a layout"
              onClick={() => openOverlay("quickStart")}
            />
          </div>
        )}

        <p className={cn("text-center text-ui-sm text-fg-muted", !rootPath && "hidden")}>
          Agents in other spaces keep running. The pill at the top right still shows them.
        </p>
      </div>
    </div>
  );
}
