import { useCallback, useEffect, useState } from "react";
import { GitBranch, PaperPlaneRight, SquareSplitHorizontal, Stop, X } from "@phosphor-icons/react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Input } from "@/shared/components/ui/input";
import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
} from "@/shared/components/ui/overlay-sheet";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useAgentStore } from "@/features/agent/store";

import { focusAttentionSession } from "../notifications/focusSession";
import { ChatTranscript } from "../panes/ChatTranscript";
import { SessionReview } from "../review/SessionReview";
import type { ReviewRow } from "../review/rows";
import { useReviewRows } from "../review/useReviewRows";
import { stopSessions } from "../sessions/runningSessions";
import { sessionAgentManifest } from "../sessions/sessionAgent";
import { selectAgentState, useAgentStatesStore } from "../state/agentStates";
import { getTerminalSize, resizeTerminal, writeTerminal } from "../terminal/runner";
import { TerminalPane } from "../terminal/TerminalPane";
import { isGeneratedTerminalTitle } from "../terminal/title";
import { sessionCwd, sessionEnvironment } from "../worktree/cwd";

type PeekTab = "session" | "changes";

const SUBMIT_DELAY_MS = 150;

function homePath(path: string): string {
  return path.replace(/^\/(Users|home)\/[^/]+/, "~");
}

/** Shows a CLI's terminal beside its pane and gives the pane its size back afterwards. */
function PeekTerminal({ session }: { session: ChatSession }) {
  // Read during render: the terminal below resizes the PTY in its own effect.
  const [paneSize] = useState(() => getTerminalSize(session.id));
  useEffect(
    () => () => {
      if (paneSize) void resizeTerminal(session.id, paneSize.cols, paneSize.rows);
    },
    [paneSize, session.id],
  );
  return <TerminalPane session={session} />;
}

function ReplyField({ session, agentName }: { session: ChatSession; agentName: string }) {
  const [text, setText] = useState("");
  const send = () => {
    const reply = text.trim();
    if (!reply) return;
    // A running CLI takes the text like typing; Enter goes separately so a TUI does not read a paste.
    void writeTerminal(session.id, reply).then(() => {
      window.setTimeout(() => void writeTerminal(session.id, "\r"), SUBMIT_DELAY_MS);
    });
    setText("");
  };
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={`Reply to ${agentName}`}
        aria-label={`Reply to ${agentName}`}
        className="h-10 flex-1"
      />
      <IconButton icon={PaperPlaneRight} label="Send" type="submit" disabled={!text.trim()} />
    </form>
  );
}

function PeekChanges({ session, cwd }: { session: ChatSession; cwd: string | null }) {
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const environment = useAIStore((state) => sessionEnvironment(session, state.workEnvironments));
  const ownsRun = runSessionId === session.id;
  const { rows, error } = useReviewRows({ sessionId: session.id, cwd, ownsRun });
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const onSelectRow = useCallback((row: ReviewRow) => setSelectedRowId(row.id), []);
  const branch =
    environment?.kind === "worktree" && environment.setupStatus === "ready"
      ? environment.branch
      : null;

  if (!cwd) {
    return <p className="p-4 text-ui-sm text-fg-muted">This session has no folder to compare.</p>;
  }
  return (
    <SessionReview
      sessionId={session.id}
      cwd={cwd}
      ownsRun={ownsRun}
      worktreeBranch={branch}
      rows={rows}
      error={error}
      selectedRowId={selectedRowId}
      onSelectRow={onSelectRow}
    />
  );
}

function PeekBody({ session, onClose }: { session: ChatSession; onClose: () => void }) {
  const manifest = useAIStore((store) => sessionAgentManifest(store, session.id));
  const environment = useAIStore((store) => sessionEnvironment(session, store.workEnvironments));
  const cwd = useAIStore((store) => {
    const path = sessionCwd(session, store.workEnvironments, session.rootPath);
    return path && path !== "default" ? path : null;
  });
  const spaceName = useOpenRepositoriesStore(
    (store) => store.spaces.find((space) => space.folders.includes(session.rootPath))?.name ?? null,
  );
  const state = useAgentStatesStore(selectAgentState(session.id));
  const [tab, setTab] = useState<PeekTab>("session");

  const agentName = manifest?.name ?? "Pragma";
  const isTerminal = session.kind === "terminal";
  const title =
    manifest && isGeneratedTerminalTitle(session.title, manifest.name)
      ? manifest.name
      : session.title;
  const branch = environment?.kind === "worktree" ? environment.branch : null;

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 py-4 pr-3 pl-5">
        {manifest ? (
          <AgentMark agentId={manifest.id} name={manifest.name} size="lg" />
        ) : (
          <PragmaMark variant="compact" className="size-6.5 shrink-0 text-fg-default" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <OverlaySheetTitle className="truncate text-[15px]">{title}</OverlaySheetTitle>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-ui-sm text-fg-muted">
            {agentName}
            {spaceName && <span>· {spaceName}</span>}
            {branch && <span className="truncate font-mono text-ui-xs">· {branch}</span>}
          </span>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <span className="mr-1.5 flex h-6 items-center gap-1.5 rounded-[6px] bg-bg-hover px-2 text-ui-xs text-fg-muted">
            <StatusDot state={state} decorative />
            {AGENT_STATE_LABELS[state]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              focusAttentionSession(session.id);
            }}
          >
            <SquareSplitHorizontal size={13} aria-hidden="true" />
            Open as pane
          </Button>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </span>
      </header>

      <div className="flex shrink-0 items-center px-5 pb-3">
        <SegmentedControl<PeekTab>
          label="Peek sections"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "session", label: "Session" },
            { value: "changes", label: "Changes" },
          ]}
        />
      </div>

      <div className="mx-2.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-well bg-bg-well ring-1 ring-border-subtle ring-inset">
        {tab === "changes" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PeekChanges session={session} cwd={cwd} />
          </div>
        ) : isTerminal ? (
          <div className="min-h-0 flex-1">
            <PeekTerminal session={session} />
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <ChatTranscript sessionId={session.id} />
          </div>
        )}
      </div>

      {tab === "session" && (
        <div className="shrink-0 px-2.5 pt-2.5">
          {isTerminal ? (
            <ReplyField session={session} agentName={agentName} />
          ) : (
            <p className="px-1 text-ui-xs text-fg-subtle">Open the session as a pane to reply.</p>
          )}
        </div>
      )}

      <footer className="flex shrink-0 items-center gap-2 px-5 py-3 text-ui-xs text-fg-muted">
        {cwd && (
          <>
            <GitBranch size={13} aria-hidden="true" />
            <span className="min-w-0 truncate font-mono">{homePath(cwd)}</span>
          </>
        )}
        <span className="ml-auto flex shrink-0 gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => stopSessions([session.id])}>
            <Stop size={12} aria-hidden="true" />
            Stop
          </Button>
          {tab === "session" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => useOverlayStore.getState().open("review", session.id)}
            >
              Review
            </Button>
          )}
        </span>
      </footer>
    </>
  );
}

/// Looks into one agent without giving it a pane: the session slides in from the right.
export function AgentPeek() {
  const active = useOverlayStore((state) => state.active);
  const target = useOverlayStore((state) => state.target);
  const close = useOverlayStore((state) => state.close);
  const session = useAIStore((state) =>
    target ? state.chatSessions.find((item) => item.id === target) : undefined,
  );
  // Keep the last session while the sheet slides out.
  const [shown, setShown] = useState<ChatSession | undefined>(session);
  if (session && session !== shown) setShown(session);
  const open = active === "peek" && session !== undefined;

  return (
    <OverlaySheet open={open} onOpenChange={(next) => !next && close("peek")}>
      <OverlaySheetContent placement="right" className="pb-0">
        {shown && <PeekBody key={shown.id} session={shown} onClose={() => close("peek")} />}
      </OverlaySheetContent>
    </OverlaySheet>
  );
}
