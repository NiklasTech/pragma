import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useOverlayStore } from "@/shared/stores/overlays";
import { SessionMark, useSessionIdentity } from "@/shell/chrome/SessionMark";

import { sessionTokens } from "../../subscription/summary";
import { getTerminalBuffer, subscribeTerminalOutput } from "../../terminal/runner";
import { formatTokens } from "../../usage/formatTokens";
import { formatStateDuration, type DashboardItem } from "../dashboard";
import { lastTerminalLine } from "./activityModel";
import { goToSession } from "./goToSession";
import { useSessionFacts } from "./useSessionFacts";

export const RUNNING_COLUMNS =
  "grid grid-cols-[100px_minmax(0,1fr)_200px_190px_64px_60px_56px] items-center gap-4.5";
const EARLIER_COLUMNS =
  "grid grid-cols-[44px_64px_minmax(0,1fr)_200px_190px_56px] items-center gap-4.5";

const LAST_LINE_INTERVAL_MS = 250;

/// The last line a terminal printed, or the start of the last reply of a chat.
function useLastLine(item: DashboardItem): string {
  const { session } = item;
  const terminal = session.kind === "terminal";
  const [line, setLine] = useState(() =>
    terminal ? lastTerminalLine(getTerminalBuffer(session.id)) : "",
  );
  useEffect(() => {
    if (!terminal) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      timer = null;
      setLine(lastTerminalLine(getTerminalBuffer(session.id)));
    };
    read();
    const unsubscribe = subscribeTerminalOutput(session.id, () => {
      timer ??= setTimeout(read, LAST_LINE_INTERVAL_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [terminal, session.id]);
  if (terminal) return line;
  const reply = [...session.messages].reverse().find((message) => message.role === "assistant");
  return (
    reply?.content
      .split("\n")
      .find((text) => text.trim())
      ?.trim() ?? ""
  );
}

/// A session at work: its last line, who runs it and where, for how long, and a way to its pane.
export function RunningRow({ item, now }: { item: DashboardItem; now: number }) {
  const { session } = item;
  const identity = useSessionIdentity(session.id);
  const facts = useSessionFacts(session);
  const lastLine = useLastLine(item);
  const tokens = sessionTokens(session);
  const word = identity.shell ? "running" : "working";

  return (
    <div className={cn(RUNNING_COLUMNS, "border-t border-border-subtle px-4 py-2.75")}>
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
      <div className="flex min-w-0 flex-col gap-0.75">
        <span className="truncate text-ui-sm text-fg-default">{identity.title}</span>
        <code className="truncate font-mono text-ui-2xs text-fg-subtle">{lastLine || " "}</code>
      </div>
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
  );
}

const EARLIER_MARKS = {
  finished: { word: "done", text: "text-state-done", cell: "bg-state-done" },
  failed: { word: "failed", text: "text-status-error", cell: "bg-status-error" },
  idle: { word: "idle", text: "text-fg-subtle", cell: "bg-fg-subtle" },
} as const;

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/// A session that ended today: when, how, and a look at what it did.
export function EarlierRow({ item }: { item: DashboardItem }) {
  const { session } = item;
  const identity = useSessionIdentity(session.id);
  const facts = useSessionFacts(session);
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
    <div
      className={cn(
        EARLIER_COLUMNS,
        "border-t border-border-subtle px-4 py-2 font-mono text-ui-xs",
      )}
    >
      <span className="text-fg-subtle tabular-nums">{clock(item.since)}</span>
      <span className={cn("flex items-center gap-1.75", mark.text)}>
        <span aria-hidden="true" className={cn("size-1.75", mark.cell)} />
        {mark.word}
      </span>
      <span className="truncate font-sans text-ui-sm text-fg-muted">{identity.title}</span>
      <span className="truncate text-fg-subtle">
        {[facts.agent, facts.account].filter(Boolean).join(" · ")}
      </span>
      <span className="truncate text-fg-subtle" title={facts.where}>
        {facts.where}
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
  );
}
