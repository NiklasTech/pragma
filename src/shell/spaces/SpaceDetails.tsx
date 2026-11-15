import { FloppyDisk, GitBranch, GitPullRequest, SquareHalf } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { primaryFolder, type Space } from "@/shared/stores/spaces/model";
import { useGitStore } from "@/shared/stores/git";
import { useSessionActivity } from "@/features/ai/notifications/useSessionActivity";
import { openInRepository } from "@/features/ai/sessions/openInRepository";
import { presetPaneCount, useLayoutPresetsStore } from "@/features/ai/panes/layoutPresets";
import { openLayoutPreset } from "@/features/ai/panes/openLayoutPreset";
import { collectLeaves } from "@/features/ai/panes/layout";
import { useAgentsPanesStore } from "@/features/ai/panes/store";

import { worktreeRows } from "./spaceSummary";

const LABEL = "text-ui-xs font-medium text-fg-subtle";

interface SpaceDetailsProps {
  space: Space;
  active: boolean;
  onOpen: () => Promise<void>;
  onDone: () => void;
}

/// The right side of the spaces overlay: worktrees with their agents, then the tabs and layouts.
export function SpaceDetails({ space, active, onOpen, onDone }: SpaceDetailsProps) {
  const folder = primaryFolder(space);
  const sessions = useAIStore((state) => state.chatSessions);
  const environments = useAIStore((state) => state.workEnvironments);
  const manifests = useAIStore((state) => state.cliManifests);
  const branch = useGitStore((state) => (active ? (state.snapshot?.repo.branch ?? null) : null));
  const trees = useAgentsPanesStore((state) => state.trees);
  const activateTab = useOpenRepositoriesStore((state) => state.activateTab);
  const presets = useLayoutPresetsStore((state) => state.presets);
  const { waiting, running } = useSessionActivity();
  const rows = worktreeRows(folder, branch, environments, sessions);

  const openSession = async (sessionId: string) => {
    await onOpen();
    void openInRepository(folder, sessionId);
    onDone();
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-ui-lg font-semibold tracking-tight text-fg-default">
          {space.name}
        </span>
        <span className="truncate font-mono text-ui-2xs text-fg-subtle" title={folder}>
          {folder}
          {branch ? ` · ${branch}` : ""}
        </span>
      </div>

      <span className={LABEL}>Worktrees</span>
      <div className="flex flex-col overflow-hidden rounded-[12px] ring-1 ring-border-subtle ring-inset">
        {rows.map((row) => {
          const latest = row.sessions[0];
          const manifest = latest?.cliProviderId
            ? manifests.find((item) => item.id === latest.cliProviderId)
            : undefined;
          const state = latest
            ? waiting.includes(latest.id)
              ? "needs-you"
              : running.includes(latest.id)
                ? "working"
                : null
            : null;
          return (
            <div
              key={row.id}
              className="flex min-h-12 items-center gap-3 border-t border-border-subtle px-4 py-2 first:border-t-0"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <GitBranch size={13} className="shrink-0 text-fg-subtle" />
                <span className="truncate font-mono text-ui-xs text-fg-default">
                  {row.branch || "detached"}
                </span>
                {row.main && (
                  <span className="shrink-0 text-ui-xs text-fg-subtle">this folder</span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-ui-xs text-fg-muted">
                {latest ? (
                  <>
                    {manifest ? (
                      <AgentMark agentId={manifest.id} name={manifest.name} size="sm" />
                    ) : null}
                    <span className="truncate">{manifest?.name ?? latest.title}</span>
                    {state === "needs-you" && <Chip variant="needs-you">Needs you</Chip>}
                    {state === "working" && <StatusDot state="working" />}
                    {row.sessions.length > 1 && (
                      <span className="shrink-0 text-fg-subtle">+{row.sessions.length - 1}</span>
                    )}
                  </>
                ) : (
                  <span className="text-fg-subtle">{row.main ? "you" : "no agent"}</span>
                )}
              </span>
              {row.pullRequest && (
                <span className="flex shrink-0 items-center gap-1 text-ui-xs text-fg-muted">
                  <GitPullRequest size={12} />#{row.pullRequest.number}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => (latest ? void openSession(latest.id) : void onOpen().then(onDone))}
              >
                Open
              </Button>
            </div>
          );
        })}
      </div>

      <span className={LABEL}>Tabs</span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {space.tabs.map((tab) => {
          const panes = collectLeaves(trees[tab.id]?.root ?? null).length;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className="h-auto flex-col items-start gap-0.5 px-3 py-2.5 text-left font-normal ring-1 ring-border-subtle ring-inset"
              onClick={() => {
                void onOpen().then(() => {
                  activateTab(space.id, tab.id);
                  onDone();
                });
              }}
            >
              <span className="text-ui-sm text-fg-default">{tab.name}</span>
              <span className="text-ui-xs text-fg-subtle">
                {tab.kind === "code" ? "editor" : `${panes} ${panes === 1 ? "pane" : "panes"}`}
              </span>
            </Button>
          );
        })}
      </div>

      <span className={LABEL}>Layouts</span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant="ghost"
            className="h-auto justify-start gap-2 px-3 py-2.5 text-left font-normal ring-1 ring-border-subtle ring-inset"
            onClick={() => {
              void onOpen().then(() => {
                void openLayoutPreset(folder, preset);
                onDone();
              });
            }}
          >
            <SquareHalf size={14} className="shrink-0 text-fg-subtle" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-ui-sm text-fg-default">{preset.name}</span>
              <span className="text-ui-xs text-fg-subtle">
                {presetPaneCount(preset.layout)} panes
              </span>
            </span>
          </Button>
        ))}
        {presets.length === 0 && (
          <span className="flex items-center gap-2 text-ui-xs text-fg-subtle">
            <FloppyDisk size={13} />
            Save a tab from the pane layout menu to reuse it here.
          </span>
        )}
      </div>
    </div>
  );
}
