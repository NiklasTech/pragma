import { CaretRight } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useOverlayStore } from "@/shared/stores/overlays";
import { SessionMark, useSessionIdentity } from "@/shell/chrome/SessionMark";

import { sessionTokens } from "../../subscription/summary";
import { useDiffStat } from "../../overview/useDiffStat";
import { sessionEnvironment } from "../../worktree/cwd";
import { formatTokens } from "../../usage/formatTokens";
import { useAIStore } from "@/shared/stores/ai";
import { formatStateDuration, type DashboardItem } from "../dashboard";
import { formatMoment } from "./activityModel";
import { goToSession } from "./goToSession";
import { SessionDetails } from "./SessionDetails";
import { useOutputTail } from "./useOutputTail";
import { useSessionFacts } from "./useSessionFacts";
import { useAgentMenu } from "../../panes/useAgentMenu";
import { ActionContextMenu } from "@/shared/components/ui/action-menu";

export const RUNNING_COLUMNS =
  "grid grid-cols-[100px_minmax(0,1fr)_200px_190px_64px_60px_56px] items-center gap-4.5";
const EARLIER_COLUMNS =
  "grid grid-cols-[44px_64px_minmax(0,1fr)_200px_190px_96px_56px] items-center gap-4.5";

interface ExpandableProps {
  item: DashboardItem;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}

/// The session title as the switch that shows its details.
export function TitleToggle({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      aria-expanded={expanded}
      onClick={onToggle}
      title={expanded ? "Hide details" : "Show details"}
      className="-mx-1.5 h-auto min-w-0 flex-col items-stretch gap-0.75 px-1.5 py-1 text-left font-normal"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <CaretRight
          size={10}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-fg-subtle transition-transform duration-(--motion-fast)",
            expanded && "rotate-90",
          )}
        />
        <span className="truncate text-ui-sm text-fg-default">{title}</span>
      </span>
      {children}
    </Button>
  );
}

/// A session at work: its last line, who runs it and where, for how long, and a way to its pane.
export function RunningRow({ item, now, expanded, onToggle }: ExpandableProps) {
  const { session } = item;
  const identity = useSessionIdentity(session.id);
  const menu = useAgentMenu(session.id);
  const facts = useSessionFacts(session);
  const lastLine = useOutputTail(session, 1)[0]?.trim() ?? "";
  const tokens = sessionTokens(session);
  const word = identity.shell ? "running" : "working";

  return (
    <ActionContextMenu menu={menu}>
      <div className="flex flex-col">
        <div className={cn(RUNNING_COLUMNS, "border-t border-border-subtle px-4 py-2")}>
          <span
            className={cn(
              "flex items-center gap-2 font-mono text-ui-xs",
              identity.shell ? "text-fg-muted" : "text-status-info",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("size-2.25", identity.shell ? "bg-fg-muted" : "bg-status-info")}
            />
            {word}
          </span>
          <TitleToggle title={identity.title} expanded={expanded} onToggle={onToggle}>
            <code className="truncate pl-4 font-mono text-ui-2xs text-fg-subtle">
              {lastLine || " "}
            </code>
          </TitleToggle>
          <span className="flex min-w-0 items-center gap-2 font-mono text-ui-xs">
            <SessionMark identity={identity} surface="sheet" />
            <span className="truncate">
              {facts.agent}
              {facts.account && <span className="text-fg-subtle"> {facts.account}</span>}
            </span>
          </span>
          <span className="truncate font-mono text-ui-xs text-fg-muted" title={facts.where}>
            {facts.where}
          </span>
          <span className="text-right font-mono text-ui-xs text-fg-muted tabular-nums">
            {formatStateDuration(now - item.since)}
          </span>
          <span className="text-right font-mono text-ui-xs text-fg-subtle tabular-nums">
            {tokens === null ? "—" : formatTokens(tokens)}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => goToSession(session.id, session.rootPath)}
            className="justify-self-end font-mono font-normal text-fg-muted"
          >
            go to
          </Button>
        </div>
        {expanded && <SessionDetails item={item} now={now} />}
      </div>
    </ActionContextMenu>
  );
}

const EARLIER_MARKS = {
  finished: { word: "done", text: "text-state-done", cell: "bg-state-done" },
  failed: { word: "failed", text: "text-status-error", cell: "bg-status-error" },
  idle: { word: "idle", text: "text-fg-subtle", cell: "bg-fg-subtle" },
} as const;

/// A session that ended today: when, how, and a look at what it did.
export function EarlierRow({ item, now, expanded, onToggle }: ExpandableProps) {
  const { session } = item;
  const identity = useSessionIdentity(session.id);
  const menu = useAgentMenu(session.id);
  const facts = useSessionFacts(session);
  const workEnvironments = useAIStore((state) => state.workEnvironments);
  const diff = useDiffStat(sessionEnvironment(session, workEnvironments));
  const mark =
    item.state === "failed"
      ? EARLIER_MARKS.failed
      : item.state === "finished"
        ? EARLIER_MARKS.finished
        : EARLIER_MARKS.idle;
  const reviewable = session.environmentId !== undefined && item.state !== "failed";
  const open = () =>
    reviewable
      ? useOverlayStore.getState().open("review", session.id)
      : goToSession(session.id, session.rootPath);

  return (
    <ActionContextMenu menu={menu}>
      <div className="flex flex-col">
        <div
          className={cn(
            EARLIER_COLUMNS,
            "border-t border-border-subtle px-4 py-1.5 font-mono text-ui-xs",
          )}
        >
          <span className="text-fg-subtle tabular-nums">{formatMoment(item.since, now)}</span>
          <span className={cn("flex items-center gap-1.75", mark.text)}>
            <span aria-hidden="true" className={cn("size-1.75", mark.cell)} />
            {mark.word}
          </span>
          <span className="min-w-0 font-sans">
            <TitleToggle title={identity.title} expanded={expanded} onToggle={onToggle} />
          </span>
          <span className="truncate text-fg-subtle">
            {[facts.agent, facts.account].filter(Boolean).join(" · ")}
          </span>
          <span className="truncate text-fg-subtle" title={facts.where}>
            {facts.where}
          </span>
          <span className="text-right whitespace-nowrap tabular-nums">
            {diff && diff.files > 0 ? (
              <>
                <span className="text-state-done">+{diff.added}</span>{" "}
                <span className="text-status-error">−{diff.removed}</span>
              </>
            ) : (
              <span className="text-fg-subtle">—</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={open}
            className="justify-self-end font-mono font-normal text-fg-muted"
          >
            {reviewable ? "review" : "open"}
          </Button>
        </div>
        {expanded && <SessionDetails item={item} now={now} />}
      </div>
    </ActionContextMenu>
  );
}
