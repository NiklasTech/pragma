import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { usePresence } from "@/shared/hooks/usePresence";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { sessionAccountLabel, useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { useSettingsStore } from "@/shared/stores/settings";

import { selectAgentState, useAgentStatesStore } from "../state/agentStates";
import { fullestWindow } from "../subscription/nearLimit";
import { selectProviderUsage, useSubscriptionUsageStore } from "../subscription/store";
import { formatPercent, formatResetIn } from "../subscription/summary";
import { useTerminalStatus } from "../terminal/useTerminalStatus";
import { cancelWait, continueWithAccount, waitForReset } from "./actions";
import { clockTime, otherAccounts, windowKey, type AccountOption } from "./options";
import { dismissHandoff, useHandoffStore } from "./store";

const SLIDE_MS = 250;
const TICK_MS = 30_000;
const CLAUDE = "anthropic-claude";

type Choice = { kind: "account"; option: AccountOption } | { kind: "wait"; at: number };

function choiceId(choice: Choice): string {
  return choice.kind === "wait" ? "wait" : `account:${choice.option.account.configDir ?? ""}`;
}

/** Near or at the usage limit, offers to go on with another account or after the reset. */
function HandoffCardFor({
  paneRootPath,
  leafId,
  session,
}: {
  paneRootPath: string;
  leafId: string;
  session: ChatSession;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const accounts = useCliAccountsStore((state) => state.accounts);
  const names = useSettingsStore((state) => state.ai.cliAccounts.names);
  const mode = useSettingsStore((state) => state.agent.limitHandoff);
  const threshold = useSettingsStore((state) => state.agent.limitThreshold);
  const usageByAccount = useSubscriptionUsageStore((state) => state.byProvider);
  const agentState = useAgentStatesStore(selectAgentState(session.id));
  const terminal = useTerminalStatus(session.id);
  const limitHit = useHandoffStore((state) => state.limitHit[session.id]);
  const dismissed = useHandoffStore((state) => state.dismissed[session.id]);
  const waitingUntil = useHandoffStore((state) => state.waitingUntil[session.id]);

  const accountDir = session.cliAccountDir ?? null;
  const usage = selectProviderUsage({ byProvider: usageByAccount }, CLAUDE, accountDir).usage;
  const fullest = fullestWindow(usage, now);
  const near = fullest !== null && fullest.usedPercent >= threshold;
  const key = windowKey(near ? fullest : null);
  const running = terminal.status === "running";
  // The card waits for the turn to end, so it never talks over an agent at work.
  const asking =
    mode !== "off" &&
    running &&
    (near || limitHit !== undefined) &&
    agentState !== "working" &&
    dismissed !== key;
  const open = asking || waitingUntil !== undefined;
  const { mounted, shown } = usePresence(open, SLIDE_MS);

  const options = otherAccounts(
    accounts,
    CLAUDE,
    accountDir,
    (account) =>
      selectProviderUsage({ byProvider: usageByAccount }, CLAUDE, account.configDir).usage,
    names,
    now,
  );
  const choices: Choice[] = [
    ...options.map((option): Choice => ({ kind: "account", option })),
    ...(fullest?.resetsAtMs ? [{ kind: "wait" as const, at: fullest.resetsAtMs }] : []),
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const choice = choices.find((item) => choiceId(item) === selected) ?? choices[0] ?? null;
  const [busy, setBusy] = useState(false);

  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!asking || announced.current === key) return;
    announced.current = key;
    useAgentStatesStore.getState().apply(session.id, "needs-you");
  }, [asking, key, session.id]);

  if (!mounted) return null;
  const current =
    sessionAccountLabel(accounts, names, CLAUDE, session.cliAccountDir) ?? "this account";

  const settle = () => {
    const states = useAgentStatesStore.getState();
    if (states.entries[session.id]?.state === "needs-you") states.apply(session.id, "idle");
  };

  const go = () => {
    if (!choice) return;
    if (choice.kind === "wait") {
      settle();
      waitForReset(session, choice.at);
      return;
    }
    setBusy(true);
    void continueWithAccount(paneRootPath, leafId, session, choice.option.account.configDir)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setBusy(false));
  };

  const frame = cn(
    "absolute inset-x-3 bottom-3 z-10 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-well bg-bg-sheet font-mono text-ui-xs shadow-[var(--shadow-md)] ring-1 ring-state-needs-you/40 transition-[translate,opacity] duration-(--motion-base) ease-(--motion-ease-out)",
    shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
  );

  if (waitingUntil !== undefined) {
    return (
      <section aria-label="Waiting for the usage reset" className={cn(frame, "px-3 py-2.5")}>
        <div className="flex items-center gap-3">
          <span className="text-fg-default">Continues at {clockTime(waitingUntil)}</span>
          <span className="text-fg-subtle">then Pragma tells the agent to go on</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => cancelWait(session.id)}
          >
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  const percent = fullest ? formatPercent(fullest.usedPercent) : null;
  const headline = limitHit
    ? `Claude Code ${current} reached its usage limit`
    : `Claude Code ${current} is at ${percent} of its ${fullest?.label.toLowerCase() ?? "plan"}`;
  const reset =
    fullest?.resetsAtMs != null
      ? `resets at ${clockTime(fullest.resetsAtMs)}, ${formatResetIn(fullest.resetsAtMs, now)?.replace("resets in", "in") ?? ""}`
      : null;

  return (
    <section aria-label="Usage limit" className={cn(frame, "gap-3 px-4 py-3.5")}>
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-state-needs-you">{headline}</span>
        {reset && <span className="text-fg-subtle">{reset}</span>}
      </div>

      {choices.length > 0 ? (
        <div role="radiogroup" aria-label="Continue with" className="flex flex-col gap-1.5">
          {choices.map((item) => {
            const id = choiceId(item);
            const active = choice !== null && choiceId(choice) === id;
            return (
              <Button
                key={id}
                variant="ghost"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(id)}
                className={cn(
                  "h-auto justify-start gap-3 px-3 py-2 text-left font-normal ring-1 ring-inset",
                  active
                    ? "bg-accent-subtle ring-state-needs-you/40 hover:bg-accent-subtle"
                    : "ring-border-subtle",
                )}
              >
                {item.kind === "account" ? (
                  <AgentMark agentId={CLAUDE} name="Claude Code" />
                ) : (
                  <span className="w-4 text-center text-fg-subtle" aria-hidden="true">
                    ··
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-fg-default">
                    {item.kind === "account"
                      ? `Claude Code · ${item.option.label}`
                      : "Wait for the reset"}
                  </span>
                  <span className="truncate text-fg-subtle">
                    {item.kind === "account"
                      ? `same conversation, continues where ${current} stopped`
                      : `pauses, then sends "continue" at ${clockTime(item.at)}`}
                  </span>
                </span>
                {item.kind === "account" && item.option.fullest && (
                  <span className="ml-auto shrink-0 text-fg-muted">
                    {formatPercent(item.option.fullest.usedPercent)} used
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      ) : (
        <span className="text-fg-muted">
          No other Claude Code account is signed in. Add one in Settings › Agents.
        </span>
      )}

      <div className="flex items-center gap-2">
        {choice && (
          <Button size="sm" disabled={busy} onClick={go}>
            {choice.kind === "wait"
              ? `Wait until ${clockTime(choice.at)}`
              : `Continue with ${choice.option.label}`}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            settle();
            dismissHandoff(session.id, key);
          }}
        >
          Keep going here
        </Button>
        <span className="ml-auto truncate text-fg-subtle">stays in this pane</span>
      </div>
    </section>
  );
}

/** The handoff card of a pane whose Claude Code session nears or hits its usage limit. */
export function HandoffCard({
  paneRootPath,
  leafId,
  sessionId,
}: {
  paneRootPath: string;
  leafId: string;
  sessionId: string | null;
}) {
  const session = useAIStore((state) =>
    sessionId ? state.chatSessions.find((item) => item.id === sessionId) : undefined,
  );
  if (!session || session.kind !== "terminal" || session.cliProviderId !== CLAUDE) return null;
  return <HandoffCardFor paneRootPath={paneRootPath} leafId={leafId} session={session} />;
}
