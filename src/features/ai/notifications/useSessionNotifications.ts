import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";

import { useAgentStore } from "@/features/agent/store";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore, type NotificationSettings } from "@/shared/stores/settings";

import { useAcpApprovalsStore } from "../acp/acpApprovals";
import { useSpawnApprovalsStore } from "../children/acpSpawn";
import { useChildRunsStore } from "../children/runStore";
import { useSessionRunsStore } from "../tasks/sessionRuns";
import { subscribeTerminalAttention } from "../terminal/runner";
import { attentionMessage, childRunOutcomes, type AttentionKind } from "./activity";
import { playAttentionTone, useAttentionCardsStore } from "./attentionCards";
import { resolveAttentionDelivery } from "./delivery";
import { focusAttentionSession } from "./focusSession";
import { setAttentionBadge, showSystemNotification } from "./notifier";
import { subscribeSessionOutcomes } from "./outcomes";
import { readSessionInView } from "./sessionInView";
import { readSessionActivity } from "./useSessionActivity";
import { summarizeAgentStates, useAgentStatesStore } from "../state/agentStates";

/** Whether an event of this kind notifies; a waiting agent always does. */
function kindEnabled(kind: AttentionKind, settings: NotificationSettings): boolean {
  if (kind === "finished") return settings.sessionFinished;
  if (kind === "failed") return settings.sessionFailed;
  return true;
}

/// Notifies about sessions that need attention, with a popup while Pragma is focused and a
/// system notification while it is in the background, and keeps the dock badge up to date.
export function useSessionNotifications(): void {
  useEffect(() => {
    let active = true;
    let focused = document.hasFocus();
    let pendingSessionId: string | null = null;
    let waiting = new Set(readSessionActivity().waiting);
    let unlistenFocus: UnlistenFn | undefined;

    const notify = (sessionId: string, kind: AttentionKind) => {
      const settings = useSettingsStore.getState().notifications;
      const delivery = resolveAttentionDelivery({
        enabled: kindEnabled(kind, settings),
        windowFocused: focused,
        sessionInView: readSessionInView(sessionId),
        card: settings.card,
        system: settings.system,
      });
      if (delivery === "none") return;
      if (delivery === "card") {
        useAttentionCardsStore.getState().push(sessionId, kind);
        if (settings.sound) playAttentionTone();
        return;
      }
      const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
      const message = attentionMessage(kind, session?.title || "A session");
      pendingSessionId = sessionId;
      void showSystemNotification(message.title, message.body, settings.sound);
    };

    const refresh = () => {
      const activity = readSessionActivity();
      for (const sessionId of activity.waiting) {
        if (!waiting.has(sessionId)) notify(sessionId, "approval");
      }
      waiting = new Set(activity.waiting);
      const { needsYou } = summarizeAgentStates(useAgentStatesStore.getState().entries);
      setAttentionBadge(needsYou.length);
    };

    const unsubscribes = [
      useAgentStore.subscribe(refresh),
      useSessionRunsStore.subscribe(refresh),
      useSpawnApprovalsStore.subscribe(refresh),
      useAcpApprovalsStore.subscribe(refresh),
      useChildRunsStore.subscribe((state, previous) => {
        for (const outcome of childRunOutcomes(previous.runs, state.runs)) {
          notify(outcome.sessionId, outcome.kind);
        }
        refresh();
      }),
      useSettingsStore.subscribe((state, previous) => {
        if (state.notifications !== previous.notifications) refresh();
      }),
      useAgentStatesStore.subscribe(refresh),
      subscribeSessionOutcomes(notify),
      subscribeTerminalAttention(notify),
    ];
    refresh();

    void (async () => {
      try {
        const unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
          focused = payload;
          if (!payload || !pendingSessionId) return;
          // Desktop notifications report no click; the window regaining focus stands in for it.
          const sessionId = pendingSessionId;
          pendingSessionId = null;
          const exists = useAIStore.getState().chatSessions.some((item) => item.id === sessionId);
          if (exists) focusAttentionSession(sessionId);
        });
        if (active) unlistenFocus = unlisten;
        else void unlistenQuietly(unlisten);
      } catch {
        // Tauri is unavailable outside the desktop runtime.
      }
    })();

    return () => {
      active = false;
      for (const unsubscribe of unsubscribes) unsubscribe();
      void unlistenQuietly(unlistenFocus);
    };
  }, []);
}
