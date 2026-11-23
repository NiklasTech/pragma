import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { usePresence } from "@/shared/hooks/usePresence";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { useSessionEnvironment } from "../worktree/useSessionEnvironment";
import type { FailureLog } from "./failureMessage";
import { ignoreFailure, loadFailureLogs, openCheckLog, sendFailureToAgent } from "./failureActions";
import { environmentAgentSession } from "./send";
import { useAgentCiStore, type AgentCi } from "./store";

const SLIDE_MS = 250;

function FailedChecks({ ci }: { ci: AgentCi }) {
  const status = ci.status;
  if (!status) return null;
  const passed = status.total - status.failing.length - status.pending;
  return (
    <ul className="flex flex-col gap-0.5 px-3 pb-2">
      {status.failing.map((check) => (
        <li key={check.link || check.name} className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 bg-state-needs-you" aria-hidden="true" />
          <span className="min-w-0 truncate text-fg-default">{check.name}</span>
          <span className="ml-auto shrink-0 text-fg-subtle">failed</span>
        </li>
      ))}
      {status.pending > 0 && (
        <li className="flex items-center gap-2">
          <span className="size-2 shrink-0 bg-state-working" aria-hidden="true" />
          <span className="text-fg-muted">{status.pending} still running</span>
        </li>
      )}
      {passed > 0 && (
        <li className="flex items-center gap-2">
          <span className="size-2 shrink-0 bg-state-done" aria-hidden="true" />
          <span className="text-fg-muted">{passed} passed</span>
        </li>
      )}
    </ul>
  );
}

function LogTail({ log }: { log: FailureLog }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [log]);
  return (
    <div className="mx-3 flex flex-col gap-1">
      <span className="text-fg-subtle">{log.check.name} · last lines</span>
      <pre
        ref={ref}
        className="max-h-44 overflow-auto rounded-[6px] bg-bg-well px-2.5 py-2 text-ui-2xs leading-relaxed whitespace-pre-wrap text-fg-muted ring-1 ring-border-subtle ring-inset"
      >
        {log.excerpt}
      </pre>
    </div>
  );
}

/** Tells about a failed CI run on the pane's pull request and hands it to the agent. */
export function CiFailureCard({
  rootPath,
  environmentId,
}: {
  rootPath: string;
  environmentId: string | undefined;
}) {
  const ci = useAgentCiStore((state) =>
    environmentId ? state.byEnvironment[environmentId] : undefined,
  );
  const handled = useAgentCiStore((state) =>
    environmentId ? state.handled[environmentId] : undefined,
  );
  const asking = useAgentCiStore((state) =>
    environmentId ? state.asking[environmentId] : undefined,
  );
  const status = ci?.status;
  const open =
    status?.state === "failing" && asking === status.failureKey && handled !== status.failureKey;
  const { mounted, shown } = usePresence(open, SLIDE_MS);
  // The card keeps the failure it showed while it slides away.
  const shownCi = useRef<AgentCi | undefined>(undefined);
  if (open) shownCi.current = ci;
  const failureKey = open ? status.failureKey : null;

  const failing = useRef(status?.failing ?? []);
  failing.current = status?.failing ?? [];

  const fixOnItsOwn = useSettingsStore((state) => state.agent.ciFailure === "fix");
  const [log, setLog] = useState<FailureLog | "loading" | null>(null);
  const [sending, setSending] = useState(false);

  // The key names the failed checks, so the logs only reload for a new failure.
  useEffect(() => {
    if (!failureKey) return;
    let active = true;
    setLog("loading");
    void loadFailureLogs(rootPath, failing.current).then((logs) => {
      if (active) setLog(logs.find((item) => item.excerpt.trim()) ?? null);
    });
    return () => {
      active = false;
    };
  }, [failureKey, rootPath]);

  const card = shownCi.current;
  if (!mounted || !environmentId || !card?.status) return null;
  const agent = environmentAgentSession(rootPath, environmentId);
  const logLink = card.status.failing.find((check) => check.link)?.link;

  const send = () => {
    setSending(true);
    void sendFailureToAgent(rootPath, environmentId).finally(() => setSending(false));
  };

  return (
    <section
      aria-label={`CI failed on pull request ${card.number}`}
      className={cn(
        "absolute inset-x-3 bottom-3 z-10 mx-auto flex max-w-2xl flex-col gap-2 overflow-hidden rounded-well bg-bg-sheet pt-2.5 font-mono text-ui-xs shadow-[var(--shadow-md)] ring-1 ring-state-needs-you/40 transition-[translate,opacity] duration-(--motion-base) ease-(--motion-ease-out)",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <header className="flex items-baseline gap-2 px-3">
        <span className="font-semibold text-state-needs-you">CI failed on #{card.number}</span>
        <span className="text-fg-subtle">
          {card.status.failing.length} of {card.status.total} checks
        </span>
      </header>
      <FailedChecks ci={card} />
      {log === "loading" ? (
        <span className="mx-3 text-fg-subtle">Reading the log…</span>
      ) : (
        log && <LogTail log={log} />
      )}
      <footer className="flex items-center gap-2 px-3 pt-1 pb-2.5">
        <Button
          size="sm"
          disabled={!agent || sending}
          title={agent ? undefined : "No agent is running in this worktree"}
          onClick={send}
        >
          Send to agent
        </Button>
        {logLink && (
          <Button size="sm" variant="outline" onClick={() => openCheckLog(logLink)}>
            Open log
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => ignoreFailure(rootPath, environmentId)}>
          Ignore
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-fg-muted select-none">
          <Checkbox
            checked={fixOnItsOwn}
            onCheckedChange={(checked) =>
              useSettingsStore
                .getState()
                .setAgentSettings({ ciFailure: checked === true ? "fix" : "ask" })
            }
            className="size-3.5"
          />
          fix on its own next time
        </label>
      </footer>
    </section>
  );
}

/** The failure card of the worktree a pane's session works in. */
export function PaneCiFailureCard({ sessionId }: { sessionId: string | null }) {
  const session = useAIStore((state) =>
    sessionId ? state.chatSessions.find((item) => item.id === sessionId) : undefined,
  );
  const environment = useSessionEnvironment(session);
  if (!session || environment?.kind !== "worktree") return null;
  return <CiFailureCard rootPath={session.rootPath} environmentId={environment.id} />;
}
