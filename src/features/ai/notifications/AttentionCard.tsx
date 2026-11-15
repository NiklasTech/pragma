import { useEffect, useRef } from "react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { StatusDot, type AgentState } from "@/shared/components/ui/status-dot";
import { useAIStore } from "@/shared/stores/ai";
import { useOverlayStore } from "@/shared/stores/overlays";

import { sessionAgentManifest } from "../sessions/sessionAgent";
import { selectAgentState, useAgentStatesStore } from "../state/agentStates";
import { useFirstRequest } from "../state/useFirstRequest";
import { isGeneratedTerminalTitle } from "../terminal/title";
import type { AttentionKind } from "./activity";
import { useAttentionCardsStore, type AttentionCardItem } from "./attentionCards";

const EXIT_MS = 160;

const ANNOUNCED: Record<AttentionKind, AgentState> = {
  approval: "needs-you",
  input: "needs-you",
  failed: "needs-you",
  finished: "done",
};

function summary(kind: AttentionKind): string {
  if (kind === "finished") return "Finished its task";
  if (kind === "failed") return "Stopped with an error";
  if (kind === "input") return "Waits for your answer";
  return "Waits for your approval";
}

function Card({ card, more }: { card: AttentionCardItem; more: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useAttentionCardsStore((state) => state.dismiss);
  const openOverlay = useOverlayStore((state) => state.open);
  const session = useAIStore((state) =>
    state.chatSessions.find((item) => item.id === card.sessionId),
  );
  const manifest = useAIStore((state) => sessionAgentManifest(state, card.sessionId));
  const state = useAgentStatesStore(selectAgentState(card.sessionId));
  const request = useFirstRequest(card.sessionId);

  const leave = (then?: () => void) => {
    const element = ref.current;
    const done = () => {
      dismiss(card.sessionId);
      then?.();
    };
    if (!element || typeof element.animate !== "function") return done();
    element.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(8px)" },
      ],
      { duration: EXIT_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
    window.setTimeout(done, EXIT_MS);
  };

  // The card goes once its news is old: the question was answered or the result was seen.
  const stale = !session || state !== ANNOUNCED[card.kind];
  useEffect(() => {
    if (stale) dismiss(card.sessionId);
  }, [stale, dismiss, card.sessionId]);

  if (!session) return null;
  const name = manifest?.name ?? "Pragma";
  const title =
    manifest && isGeneratedTerminalTitle(session.title, manifest.name)
      ? manifest.name
      : session.title;

  return (
    <div
      ref={ref}
      role="status"
      aria-label={`${name}: ${summary(card.kind)}`}
      className="pointer-events-auto flex w-[340px] animate-in flex-col gap-2.5 rounded-[12px] bg-bg-sheet py-3 pr-3 pl-3.5 shadow-[var(--shadow-md)] ring-1 ring-border duration-200 ease-(--motion-ease-out) ring-inset fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none"
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot state={state} decorative />
        {manifest ? (
          <AgentMark agentId={manifest.id} name={name} size="sm" />
        ) : (
          <PragmaMark variant="compact" className="size-3.75 shrink-0" />
        )}
        <span className="min-w-0 truncate text-ui-sm font-medium text-fg-default">{title}</span>
        {more > 0 && (
          <span className="ml-auto shrink-0 text-ui-xs text-fg-subtle">+{more} more</span>
        )}
      </div>
      <p className="min-w-0 truncate text-ui-sm text-fg-muted">
        {request ? (
          <>
            Wants to run{" "}
            <code className="font-mono text-ui-xs text-state-needs-you" title={request.request}>
              {request.request}
            </code>
          </>
        ) : (
          summary(card.kind)
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => leave(() => openOverlay("peek", card.sessionId))}
        >
          Open
        </Button>
        <Button variant="ghost" size="sm" onClick={() => leave()}>
          Later
        </Button>
        {request && (
          <Button size="sm" className="ml-auto" onClick={() => leave(request.allow)}>
            Allow
          </Button>
        )}
      </div>
    </div>
  );
}

/// The newest event that needs you, as a small card at the bottom right instead of a panel.
export function AttentionCard() {
  const cards = useAttentionCardsStore((state) => state.cards);
  const newest = cards[cards.length - 1];
  if (!newest) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end">
      <Card key={newest.sessionId + newest.at} card={newest} more={cards.length - 1} />
    </div>
  );
}
