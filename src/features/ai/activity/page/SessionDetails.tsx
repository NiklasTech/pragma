import { Button } from "@/shared/components/ui/button";
import { useAIStore } from "@/shared/stores/ai";
import { useOverlayStore } from "@/shared/stores/overlays";

import { useDiffStat } from "../../overview/useDiffStat";
import { formatTokens } from "../../usage/formatTokens";
import { sessionEnvironment } from "../../worktree/cwd";
import { formatStateDuration, type DashboardItem } from "../dashboard";
import { formatMoment } from "./activityModel";
import { goToSession } from "./goToSession";
import { useOutputTail } from "./useOutputTail";
import { useSessionFacts } from "./useSessionFacts";

const TAIL_LINES = 8;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-fg-default">{children}</dd>
    </>
  );
}

/// What a session printed last, where it works, what it changed and what it cost.
export function SessionDetails({ item, now }: { item: DashboardItem; now: number }) {
  const { session } = item;
  const facts = useSessionFacts(session);
  const tail = useOutputTail(session, TAIL_LINES);
  const workEnvironments = useAIStore((state) => state.workEnvironments);
  const environment = sessionEnvironment(session, workEnvironments);
  const diff = useDiffStat(environment);
  const usage = session.usage;
  const worktree = environment?.kind === "worktree";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 border-t border-border-subtle bg-bg-sheet/60 px-4 py-3.5">
      <pre
        aria-label="Last output"
        className="min-h-24 overflow-hidden rounded-md bg-bg-well px-3 py-2.5 font-mono text-ui-2xs leading-relaxed whitespace-pre-wrap text-fg-muted ring-1 ring-border-subtle ring-inset"
      >
        {tail.length > 0 ? tail.join("\n") : "no output yet"}
      </pre>
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-1.25 font-mono text-ui-2xs">
          <Fact label="started">
            {formatMoment(session.createdAt, now)} · {formatStateDuration(now - session.createdAt)}{" "}
            ago
          </Fact>
          <Fact label="agent">{facts.agent}</Fact>
          {facts.account && <Fact label="account">{facts.account}</Fact>}
          <Fact label="where">
            <span title={worktree ? environment.path : undefined}>{facts.where}</span>
          </Fact>
          {diff && (
            <Fact label="changes">
              {diff.files} {diff.files === 1 ? "file" : "files"}{" "}
              <span className="text-state-done">+{diff.added}</span>{" "}
              <span className="text-status-error">−{diff.removed}</span>
            </Fact>
          )}
          {usage && usage.responses > 0 && (
            <>
              <Fact label="tokens">
                {formatTokens(usage.inputTokens)} in · {formatTokens(usage.outputTokens)} out
              </Fact>
              <Fact label="cache">
                {formatTokens(usage.cacheReadTokens)} read · {formatTokens(usage.cacheWriteTokens)}{" "}
                written
              </Fact>
              {usage.contextTokens !== undefined && (
                <Fact label="context">
                  {formatTokens(usage.contextTokens)}
                  {usage.contextWindow
                    ? ` of ${formatTokens(usage.contextWindow)} (${Math.round((usage.contextTokens / usage.contextWindow) * 100)}%)`
                    : ""}
                </Fact>
              )}
            </>
          )}
        </dl>
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => goToSession(session.id, session.rootPath)}
            className="font-mono font-normal"
          >
            go to pane
          </Button>
          {worktree && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => useOverlayStore.getState().open("review", session.id)}
              className="font-mono font-normal"
            >
              review changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
