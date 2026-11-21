import type { ActionGroup, ActionMenuSpec, ActionTone } from "@/shared/components/ui/action-menu";
import { AGENT_STATE_LABELS, type AgentState } from "@/shared/components/ui/status-dot";
import { useAIStore } from "@/shared/stores/ai";
import { sessionAccountLabel, useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { questionChoices, questionSummary } from "@/shell/chrome/commandLine/questionChoices";
import { useSessionQuestion } from "@/shell/chrome/commandLine/useSessionQuestion";
import { useAgentSheetStore } from "@/shell/chrome/agentSheetStore";
import { railGroups } from "@/shell/chrome/railEntries";
import { useSessionIdentity } from "@/shell/chrome/SessionMark";

import { goToSession } from "../activity/page/goToSession";
import { useRenameSessionStore } from "../sessions/RenameSessionDialog";
import { selectAgentState, useAgentStatesStore } from "../state/agentStates";
import { sessionCliProvider } from "../subscription/summary";
import { cancelTerminal } from "../terminal/runner";
import { isShellSession } from "../terminal/shell";
import { purgeStaleTerminals } from "../terminal/useStaleTerminals";
import { sessionEnvironment } from "../worktree/cwd";
import { useAgentsPanesStore } from "./store";

/** What a pane header adds, since it knows its own pane. */
export interface PaneMenuActions {
  splitRight: () => void;
  zoom: () => void;
  zoomed: boolean;
  closeKeepRunning: () => void;
  stopAndClose: () => void;
  close: () => void;
}

const TONES: Record<AgentState, ActionTone> = {
  "needs-you": "needs-you",
  working: "info",
  done: "done",
  idle: "idle",
};

/** The pane that shows the session in the active tab of its space, if one does. */
function paneInActiveTab(sessionId: string): { leafId: string } | null {
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  const space = spaces.find((candidate) => candidate.id === activeSpaceId);
  if (!space) return null;
  const trees = useAgentsPanesStore.getState().trees;
  const group = railGroups(space, trees).find((candidate) => candidate.active);
  const entry = group?.entries.find((candidate) => candidate.sessionId === sessionId);
  return entry ? { leafId: entry.leafId } : null;
}

/// The right-click menu of an agent, the same in the rail, a pane header and the activity tab.
export function useAgentMenu(
  sessionId: string,
  pane?: PaneMenuActions,
): () => ActionMenuSpec | null {
  const identity = useSessionIdentity(sessionId);
  const state = useAgentStatesStore(selectAgentState(sessionId));
  const question = useSessionQuestion(sessionId);
  const accounts = useCliAccountsStore((store) => store.accounts);
  const names = useSettingsStore((store) => store.ai.cliAccounts.names);
  const workEnvironments = useAIStore((store) => store.workEnvironments);

  return () => {
    const { session } = identity;
    if (!session) return null;
    const providerId = sessionCliProvider(session);
    const account = providerId
      ? sessionAccountLabel(accounts, names, providerId, session.cliAccountDir)
      : null;
    const worktree = sessionEnvironment(session, workEnvironments)?.kind === "worktree";
    const terminal = session.kind === "terminal";
    const goTo = () => goToSession(session.id, session.rootPath);
    const groups: ActionGroup[] = [];

    let prelude = null;
    if (question.kind !== "attention") {
      const { text, request } = questionSummary(question, identity.name);
      prelude = (
        <div className="mx-0.5 mt-0.5 mb-1 flex flex-col gap-1 rounded-[5px] bg-state-needs-you/8 px-2 py-1.75 ring-1 ring-state-needs-you/35 ring-inset">
          <span className="text-ui-2xs font-semibold text-state-needs-you">{text}</span>
          {request && <code className="truncate text-ui-2xs text-fg-default">{request}</code>}
        </div>
      );
      groups.push({
        label: "answer",
        items: questionChoices(question, goTo)
          .filter((choice) => choice.key !== "⏎")
          .map((choice) => ({ key: choice.key, label: choice.label, onSelect: choice.run })),
      });
    }

    groups.push({
      items: [
        ...(pane ? [] : [{ key: "g", label: "go to pane", shortcut: "⏎", onSelect: goTo }]),
        ...(worktree
          ? [
              {
                key: "v",
                label: "review changes",
                onSelect: () => useOverlayStore.getState().open("review", session.id),
              },
            ]
          : []),
        {
          key: "s",
          label: "show in agents sheet",
          onSelect: () => useAgentSheetStore.getState().setOpen(true),
        },
      ],
    });

    groups.push({
      items: [
        {
          key: "r",
          label: "rename",
          onSelect: () => useRenameSessionStore.getState().open(session.id),
        },
        ...(pane
          ? [
              { key: "h", label: "split right", onSelect: pane.splitRight },
              { key: "z", label: pane.zoomed ? "restore pane" : "zoom pane", onSelect: pane.zoom },
            ]
          : []),
      ],
    });

    const location = pane ? null : paneInActiveTab(session.id);
    const closeLeaf = (stop: boolean) => {
      if (!location) return;
      if (stop) cancelTerminal(session.id);
      void useAgentsPanesStore
        .getState()
        .closeLeaf(session.rootPath, location.leafId)
        .then(() => purgeStaleTerminals(session.rootPath))
        .catch(() => {});
    };
    if (pane) {
      groups.push({
        items: terminal
          ? [
              { key: "p", label: "close, keep running", onSelect: pane.closeKeepRunning },
              { key: "k", label: "stop and close", danger: true, onSelect: pane.stopAndClose },
            ]
          : [{ key: "w", label: "close pane", onSelect: pane.close }],
      });
    } else if (location && terminal) {
      groups.push({
        items: [
          { key: "p", label: "close, keep running", onSelect: () => closeLeaf(false) },
          { key: "k", label: "stop and close", danger: true, onSelect: () => closeLeaf(true) },
        ],
      });
    }

    const shellOnly = isShellSession(session) && identity.shell;
    return {
      head: [
        identity.title !== identity.name ? identity.title : null,
        shellOnly ? "shell" : identity.name,
        account,
        AGENT_STATE_LABELS[state].toLowerCase(),
      ]
        .filter(Boolean)
        .join(" · "),
      tone: TONES[state],
      prelude,
      groups,
    };
  };
}
