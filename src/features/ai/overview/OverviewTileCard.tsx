import { memo } from "react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";

import { sessionAgentManifest } from "../sessions/sessionAgent";
import { useFirstRequest } from "../state/useFirstRequest";
import { isGeneratedTerminalTitle } from "../terminal/title";
import { useSessionEnvironment } from "../worktree/useSessionEnvironment";
import { sinceLabel, type OverviewTile } from "./overviewModel";
import { useDiffStat } from "./useDiffStat";
import { useTileSnippet } from "./useTileSnippet";

interface OverviewTileCardProps {
  tile: OverviewTile;
  spaceName: string | null;
  now: number;
  onOpen: (sessionId: string) => void;
  onPeek: (sessionId: string) => void;
}

/// One agent in the overview: who, where, its latest lines, its changes and what you can do.
export const OverviewTileCard = memo(function OverviewTileCard({
  tile,
  spaceName,
  now,
  onOpen,
  onPeek,
}: OverviewTileCardProps) {
  const { session, state } = tile;
  const manifest = useAIStore((store) => sessionAgentManifest(store, session.id));
  const environment = useSessionEnvironment(session);
  const branch = environment?.kind === "worktree" ? environment.branch : null;
  const stat = useDiffStat(environment);
  const lines = useTileSnippet(session);
  const allow = useFirstRequest(session.id)?.allow ?? null;
  const needsYou = state === "needs-you";
  const title =
    manifest && isGeneratedTerminalTitle(session.title, manifest.name)
      ? manifest.name
      : session.title;

  return (
    <article
      aria-label={`${manifest?.name ?? "Pragma"}, ${title}`}
      className={cn(
        "flex animate-in flex-col gap-2 rounded-[12px] bg-bg-well p-3 pb-2.5 ring-1 ring-border-subtle duration-200 ease-(--motion-ease-out) ring-inset fade-in-0 zoom-in-[0.98] motion-reduce:animate-none",
        needsYou &&
          "shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-state-needs-you)_8%,transparent)] ring-state-needs-you/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {manifest ? (
          <AgentMark agentId={manifest.id} name={manifest.name} />
        ) : (
          <PragmaMark variant="compact" className="size-4.5 shrink-0 text-fg-default" />
        )}
        <span className="min-w-0 truncate text-ui-sm font-medium text-fg-default">{title}</span>
        <StatusDot state={state} className="ml-auto" />
      </div>
      <div className="flex min-w-0 items-center gap-2 text-ui-xs text-fg-muted">
        {spaceName && <span className="shrink-0">{spaceName}</span>}
        {branch ? (
          <span className="truncate font-mono">{branch}</span>
        ) : (
          <span className="truncate">this folder</span>
        )}
      </div>
      <pre className="h-[94px] overflow-hidden rounded-[8px] bg-bg-ground px-2.5 py-2 font-mono text-[11.5px] leading-[17px] whitespace-pre-wrap text-fg-muted">
        {lines.length > 0 ? (
          lines.join("\n")
        ) : (
          <span className="text-fg-subtle">No output yet</span>
        )}
      </pre>
      <div className="flex min-h-6.5 items-center gap-2 text-ui-xs text-fg-subtle">
        {stat && stat.files > 0 && (
          <>
            <span className="font-mono text-status-success">+{stat.added}</span>
            {stat.removed > 0 && (
              <span className="font-mono text-status-error">−{stat.removed}</span>
            )}
          </>
        )}
        <span>{sinceLabel(tile.since, now)}</span>
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onPeek(session.id)}>
            Peek
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpen(session.id)}>
            Open
          </Button>
          {allow && (
            <Button size="sm" onClick={allow}>
              Allow
            </Button>
          )}
        </span>
      </div>
    </article>
  );
});
