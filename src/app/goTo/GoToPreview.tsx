import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Lightning } from "@phosphor-icons/react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import type { CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { focusAttentionSession } from "@/features/ai/notifications/focusSession";
import { useTileSnippet } from "@/features/ai/overview/useTileSnippet";
import { sessionAgentManifest } from "@/features/ai/sessions/sessionAgent";
import { selectAgentState, useAgentStatesStore } from "@/features/ai/state/agentStates";
import { useFirstRequest } from "@/features/ai/state/useFirstRequest";
import { isGeneratedTerminalTitle } from "@/features/ai/terminal/title";
import { sessionEnvironment } from "@/features/ai/worktree/cwd";

const CONTEXT_BEFORE = 4;
const SHOWN_LINES = 26;
const cache = new Map<string, string[]>();

function useFileLines(path: string): string[] | null {
  const [loaded, setLoaded] = useState<{ path: string; lines: string[] } | null>(() => {
    const cached = cache.get(path);
    return cached ? { path, lines: cached } : null;
  });
  useEffect(() => {
    if (cache.has(path)) return;
    let live = true;
    invoke<{ content: string }>("read_text_file", { path })
      .then((result) => {
        const lines = result.content.split("\n");
        cache.set(path, lines);
        if (live) setLoaded({ path, lines });
      })
      .catch(() => live && setLoaded({ path, lines: [] }));
    return () => {
      live = false;
    };
  }, [path]);
  const cached = cache.get(path);
  if (cached) return cached;
  return loaded?.path === path ? loaded.lines : null;
}

/** The file around a line, with that line marked; the top of the file without one. */
export function FilePreview({ path, label, line }: { path: string; label: string; line?: number }) {
  const lines = useFileLines(path);
  const first = line ? Math.max(1, line - CONTEXT_BEFORE) : 1;
  const shown = lines?.slice(first - 1, first - 1 + SHOWN_LINES) ?? [];
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-ui-xs text-fg-muted">
        <FileText size={13} aria-hidden="true" />
        <span className="min-w-0 truncate font-mono">{label}</span>
        {line && <span className="ml-auto shrink-0">line {line}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden pb-2 font-mono text-[12px] leading-[19px]">
        {lines?.length === 0 && (
          <p className="px-4 font-sans text-ui-xs text-fg-subtle">No preview for this file.</p>
        )}
        {shown.map((text, index) => {
          const number = first + index;
          const current = number === line;
          return (
            <div key={number} className={cn("grid grid-cols-[48px_1fr]", current && "bg-bg-hover")}>
              <span
                className={cn(
                  "pr-3.5 text-right tabular-nums",
                  current ? "text-fg-default" : "text-fg-subtle",
                )}
              >
                {number}
              </span>
              <span className="whitespace-pre-wrap wrap-break-word text-fg-muted">
                {text || " "}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AgentSnippet({ session }: { session: ChatSession }) {
  const lines = useTileSnippet(session);
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-4 font-mono text-[12px] leading-[19px] whitespace-pre-wrap text-fg-muted">
      {lines.length > 0 ? lines.join("\n") : "Nothing yet."}
    </div>
  );
}

/** An agent's latest output and what you can do with it from here. */
export function AgentPreview({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const session = useAIStore((state) => state.chatSessions.find((item) => item.id === sessionId));
  const manifest = useAIStore((state) => sessionAgentManifest(state, sessionId));
  const branch = useAIStore((state) => {
    const environment = sessionEnvironment(session, state.workEnvironments);
    return environment?.kind === "worktree" ? environment.branch : null;
  });
  const state = useAgentStatesStore(selectAgentState(sessionId));
  const request = useFirstRequest(sessionId);
  const openOverlay = useOverlayStore((store) => store.open);
  if (!session) return null;
  const name = manifest?.name ?? "Pragma";
  const title =
    manifest && isGeneratedTerminalTitle(session.title, manifest.name) ? name : session.title;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-ui-xs text-fg-muted">
        {manifest ? (
          <AgentMark agentId={manifest.id} name={name} size="sm" />
        ) : (
          <PragmaMark variant="compact" className="size-3.75 shrink-0" />
        )}
        <span className="min-w-0 truncate text-ui-sm text-fg-default">{title}</span>
        <span className="shrink-0">{name}</span>
        {branch && <span className="min-w-0 truncate font-mono">· {branch}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <StatusDot state={state} decorative />
          {AGENT_STATE_LABELS[state]}
        </span>
      </div>
      <AgentSnippet session={session} />
      <div className="flex shrink-0 gap-1.5 px-4 pt-2 pb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onDone();
            openOverlay("peek", sessionId);
          }}
        >
          Peek
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onDone();
            focusAttentionSession(sessionId);
          }}
        >
          Go to pane
        </Button>
        {request && (
          <Button size="sm" className="ml-auto" onClick={request.allow}>
            Allow
          </Button>
        )}
      </div>
    </>
  );
}

export function CommandPreview({ command }: { command: CommandPaletteItem }) {
  const binding = useSettingsStore((state) =>
    command.shortcut ? state.shortcuts[command.shortcut] : null,
  );
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-ui-xs text-fg-muted">
        <Lightning size={13} aria-hidden="true" />
        Command
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-1 text-ui-sm text-fg-muted">
        <span className="text-[14px] font-semibold text-fg-default">{command.label}</span>
        <span className="text-ui-xs text-fg-subtle">
          {binding
            ? `Shortcut ${formatShortcut(binding, getIsMac())} · change it in Settings › Keys`
            : "No shortcut · add one in Settings › Keys"}
        </span>
      </div>
    </>
  );
}
