import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CaretDown, FolderSimple, GitBranch, TerminalWindow } from "@phosphor-icons/react";
import { toast } from "sonner";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Kbd } from "@/shared/components/ui/kbd";
import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
} from "@/shared/components/ui/overlay-sheet";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { Textarea } from "@/shared/components/ui/textarea";
import { getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { refreshCLIStatuses } from "@/shared/stores/ai/cliRefresh";
import type { GitBranch as GitBranchInfo } from "@/shared/stores/git";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayOpen, useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { findSpaceByFolder } from "@/shared/stores/spaces/model";

import { useLayoutPresetsStore } from "../panes/layoutPresets";
import { LayoutDiagram } from "./LayoutDiagram";
import { quickChoices, sameAgent } from "./quickChoices";
import {
  agentPane,
  MAX_AGENT_KEYS,
  QUICK_LAYOUTS,
  quickAgents,
  taskSlug,
  taskTabTitle,
  TERMINAL_ONLY,
  withAgent,
  type QuickAgent,
} from "./quickStart";
import { WorktreeError } from "../worktree/worktreeErrors";
import { startQuickTask, type QuickWhere } from "./startQuickTask";

const CHOICE =
  "ring-1 ring-border-subtle ring-inset hover:ring-border aria-pressed:bg-control-hover aria-pressed:text-fg-default aria-pressed:ring-fg-default/40";

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
}

function QuickStartForm({ rootPath, onDone }: { rootPath: string; onDone: () => void }) {
  const manifests = useAIStore((state) => state.cliManifests);
  const statuses = useAIStore((state) => state.cliStatuses);
  const loadCLIManifests = useAIStore((state) => state.loadCLIManifests);
  const accounts = useCliAccountsStore((state) => state.accounts);
  const accountNames = useSettingsStore((state) => state.ai.cliAccounts.names);
  const presets = useLayoutPresetsStore((state) => state.presets);
  const spaceName = useOpenRepositoriesStore(
    (state) => findSpaceByFolder(state.spaces, rootPath)?.name ?? folderName(rootPath),
  );

  const { ready, missing } = useMemo(() => quickAgents(manifests, statuses), [manifests, statuses]);
  const choices = useMemo(
    () => quickChoices(ready, accounts, accountNames),
    [ready, accounts, accountNames],
  );
  // The command line hands a task over as the overlay's target.
  const [task, setTask] = useState(() => useOverlayStore.getState().target ?? "");
  const [picked, setPicked] = useState<QuickAgent | null>(null);
  const [layoutId, setLayoutId] = useState(QUICK_LAYOUTS[0].id);
  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [where, setWhere] = useState<QuickWhere>(() => useSettingsStore.getState().agent.startIn);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [baseBranch, setBaseBranch] = useState<string | null>(null);

  useEffect(() => {
    if (manifests.length === 0) void loadCLIManifests();
  }, [loadCLIManifests, manifests.length]);

  useEffect(() => {
    void refreshCLIStatuses();
  }, []);

  useEffect(() => {
    let live = true;
    invoke<{ is_repo: boolean }>("git_session_repo_check", { repoPath: rootPath })
      .then((result) => live && setIsRepo(result.is_repo))
      .catch(() => live && setIsRepo(false));
    invoke<{ branches: GitBranchInfo[] }>("git_branches", { repoPath: rootPath })
      .then((result) => live && setBranches(result.branches))
      .catch(() => live && setBranches([]));
    return () => {
      live = false;
    };
  }, [rootPath]);

  const agent: QuickAgent = picked ?? choices[0]?.agent ?? TERMINAL_ONLY;
  const pane = agentPane(agent);
  const layouts = [
    ...QUICK_LAYOUTS.map((layout) => ({
      id: layout.id,
      name: layout.name,
      node: layout.build(pane),
    })),
    ...presets.map((preset) => ({
      id: `saved:${preset.id}`,
      name: preset.name,
      node: withAgent(preset.layout, pane),
    })),
  ];
  const layout = layouts.find((item) => item.id === layoutId) ?? layouts[0];
  const inWorktree = isRepo === true && where === "worktree";
  const headBranch = branches.find((branch) => branch.is_head)?.name ?? null;
  const fromBranch = baseBranch ?? headBranch;
  const slug = taskSlug(task);
  const tabTitle = taskTabTitle(task);
  const isMac = getIsMac();

  const start = () => {
    onDone();
    startQuickTask({
      rootPath,
      task,
      layout: layout.node,
      where: inWorktree ? "worktree" : "here",
      baseBranch: inWorktree && baseBranch && baseBranch !== headBranch ? baseBranch : undefined,
    }).catch((err: unknown) => {
      if (err instanceof WorktreeError) {
        toast.error(err.title, { description: err.detail });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not start the task");
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      start();
      return;
    }
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    const number = Number(event.key);
    if (
      Number.isInteger(number) &&
      number >= 1 &&
      number <= Math.min(choices.length, MAX_AGENT_KEYS)
    ) {
      event.preventDefault();
      setPicked(choices[number - 1].agent);
    } else if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      setPicked(TERMINAL_ONLY);
    }
  };

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={onKeyDown}>
      <div className="flex flex-col gap-2 px-5.5 pt-5 pb-1.5">
        <OverlaySheetTitle className="text-ui-xs font-medium tracking-normal text-fg-muted">
          What should happen?
        </OverlaySheetTitle>
        <Textarea
          autoFocus
          value={task}
          onChange={(event) => setTask(event.target.value)}
          placeholder="Describe the task, or leave it empty to start the agent on its own"
          aria-label="Task"
          rows={3}
          className="min-h-19 resize-none bg-transparent px-0 py-0 text-ui-lg leading-snug ring-0 hover:ring-0 focus-visible:ring-0"
        />
      </div>

      <section className="flex flex-col gap-2.5 px-5.5 pt-3 pb-1">
        <span className="text-ui-xs font-medium text-fg-muted">Who</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Agent">
          {choices.map((choice, index) => (
            <Button
              key={`${choice.manifest.id}:${choice.agent.accountDir ?? ""}`}
              variant="ghost"
              aria-pressed={sameAgent(agent, choice.agent)}
              onClick={() => setPicked(choice.agent)}
              className={cn(
                "h-8.5 max-w-full min-w-0 gap-2 rounded-[9px] pr-2.5 pl-2 text-ui-sm text-fg-muted",
                CHOICE,
              )}
            >
              <AgentMark agentId={choice.manifest.id} name={choice.manifest.name} />
              {choice.manifest.name}
              {choice.accountLabel && (
                <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-subtle">
                  {choice.accountLabel}
                </span>
              )}
              {index < MAX_AGENT_KEYS && <Kbd>{index + 1}</Kbd>}
            </Button>
          ))}
          <Button
            variant="ghost"
            aria-pressed={agent.kind === "terminal"}
            onClick={() => setPicked(TERMINAL_ONLY)}
            className={cn("h-8.5 gap-2 rounded-[9px] pr-2.5 pl-2 text-ui-sm text-fg-muted", CHOICE)}
          >
            <TerminalWindow size={15} aria-hidden="true" />
            Terminal only
            <Kbd>T</Kbd>
          </Button>
          {missing.length > 0 && (
            <Button
              variant="ghost"
              disabled
              title={missing.map((item) => `${item.name}: ${item.install_cmd}`).join("\n")}
              className="h-8.5 max-w-full min-w-0 gap-2 rounded-[9px] px-2.5 text-ui-sm ring-1 ring-border-subtle ring-inset disabled:opacity-60"
            >
              <span className="truncate">{missing.map((item) => item.name).join(", ")}</span>
              <span className="text-ui-xs text-fg-subtle">not installed</span>
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 px-5.5 pt-3 pb-1">
        <span className="text-ui-xs font-medium text-fg-muted">Layout</span>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Layout">
          {layouts.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              aria-pressed={item.id === layout.id}
              onClick={() => setLayoutId(item.id)}
              className={cn(
                "h-auto flex-col items-stretch gap-2 rounded-[10px] p-2 pb-2.5 text-left text-ui-xs font-normal text-fg-muted",
                CHOICE,
              )}
            >
              <LayoutDiagram layout={item.node} />
              <span className="truncate">{item.name}</span>
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 px-5.5 pt-3 pb-1">
        <span className="text-ui-xs font-medium text-fg-muted">Where</span>
        <div className="flex items-center gap-2">
          <SegmentedControl<QuickWhere>
            label="Where"
            value={inWorktree ? "worktree" : "here"}
            onValueChange={setWhere}
            options={[
              ...(isRepo
                ? [
                    {
                      value: "worktree" as const,
                      label: (
                        <>
                          <GitBranch size={13} aria-hidden="true" />
                          New worktree
                        </>
                      ),
                    },
                  ]
                : []),
              {
                value: "here",
                label: (
                  <>
                    <FolderSimple size={13} aria-hidden="true" />
                    This folder
                  </>
                ),
              },
            ]}
          />
          {inWorktree && fromBranch && branches.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Base branch: ${fromBranch}`}
                    className="h-8.5 max-w-50 shrink-0 gap-1.5 px-2.5 font-normal text-fg-muted"
                  />
                }
              >
                from
                <span className="min-w-0 truncate font-mono text-ui-xs text-fg-default">
                  {fromBranch}
                </span>
                <CaretDown size={11} aria-hidden="true" className="shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
                {branches.map((branch) => (
                  <DropdownMenuItem
                    key={branch.name}
                    onClick={() => setBaseBranch(branch.name)}
                    className={cn(
                      "font-mono text-ui-xs",
                      branch.name === fromBranch && "bg-bg-hover",
                    )}
                  >
                    <span className="min-w-0 truncate">{branch.name}</span>
                    {branch.is_head && (
                      <span className="ml-auto shrink-0 font-sans text-ui-2xs text-fg-subtle">
                        checked out
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="flex h-8.5 min-w-0 flex-1 items-center rounded-[9px] bg-bg-well px-2.5 font-mono text-ui-xs text-fg-muted ring-1 ring-border-subtle ring-inset">
            <span className="truncate">
              {inWorktree ? (
                <>
                  <span className="text-fg-subtle">{spaceName} / </span>
                  <span className="text-fg-default">pragma/{slug ? `${slug}-…` : "…"}</span>
                </>
              ) : (
                `${folderName(rootPath)}, the folder itself`
              )}
            </span>
          </span>
        </div>
      </section>

      <footer className="mt-3.5 flex items-center gap-2 border-t border-border-subtle bg-bg-ground/40 py-3.5 pr-4 pl-5.5">
        <span className="min-w-0 truncate text-ui-sm text-fg-muted">
          Opens as tab <span className="text-fg-default">{tabTitle}</span> in {spaceName}
        </span>
        <Button variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
          <Kbd>Esc</Kbd>
        </Button>
        <Button onClick={start}>
          Start
          <Kbd className="border-0 bg-black/10 text-primary-foreground/70">
            {isMac ? "⌘⏎" : "Ctrl+Enter"}
          </Kbd>
        </Button>
      </footer>
    </div>
  );
}

/// Start anything from one dialog: a task, an agent, a layout and a place.
export function QuickStartDialog() {
  const isOpen = useOverlayOpen("quickStart");
  const close = useOverlayStore((state) => state.close);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  // Each opening starts fresh; the old form stays mounted while the sheet fades out.
  const [round, setRound] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setRound((value) => value + 1);
  }

  return (
    <OverlaySheet
      open={isOpen && rootPath !== null}
      onOpenChange={(open) => !open && close("quickStart")}
    >
      <OverlaySheetContent placement="top" className="max-w-[720px]">
        {rootPath && (
          <QuickStartForm key={round} rootPath={rootPath} onDone={() => close("quickStart")} />
        )}
      </OverlaySheetContent>
    </OverlaySheet>
  );
}
