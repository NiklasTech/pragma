import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import {
  FileMinus,
  FilePlus,
  FileText,
  GitPullRequest,
  PaperPlaneRight,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Kbd } from "@/shared/components/ui/kbd";
import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
} from "@/shared/components/ui/overlay-sheet";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { parsePatchHunks, type PatchHunk } from "@/shared/lib/diffHunks";
import { cn } from "@/shared/lib/utils";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useOverlayStore } from "@/shared/stores/overlays";
import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { findSessionTask, useTasksStore } from "@/features/ai/tasks/store";
import { sendToSession } from "@/features/ai/tasks/sessionRuns";

import { deliverTerminalPrompt } from "../children/terminalPrompt";
import { sessionAgentManifest } from "../sessions/sessionAgent";
import { getTerminalEntryStatus } from "../terminal/runner";
import { isGeneratedTerminalTitle } from "../terminal/title";
import { sessionCwd, sessionEnvironment } from "../worktree/cwd";
import { useFinishWorktree } from "../worktree/useFinishWorktree";
import { useReviewCommentsStore } from "./comments";
import { commitMessageFor, commitPaths } from "./commit";
import { restoreHunk, undoHunk } from "./hunkActions";
import { hunkKey, reviewTally, useHunkReviewStore, type UndoneHunk } from "./hunkReview";
import { addedFilePatch } from "./patch";
import { ReviewHunkCard } from "./ReviewHunkCard";
import { buildReviewLine, buildReviewMessage } from "./reviewMessage";
import type { ReviewRow } from "./rows";
import { useReviewRows } from "./useReviewRows";
import { useSessionDiffs } from "./useSessionDiffs";

type DiffView = "unified" | "split";

const REFRESH_MS = 5000;
const PROSE_OR_DATA = /\.(md|mdx|txt|json|jsonc|ya?ml|toml|lock|csv|svg)$/i;
const NO_KEYS: string[] = [];
const NO_UNDONE: UndoneHunk[] = [];

function fileHunks(patchText: string, original: string, modified: string): PatchHunk[] {
  return parsePatchHunks(patchText || addedFilePatch(original, modified));
}

function lastSummary(session: ChatSession): string | null {
  const last = [...session.messages].reverse().find((message) => message.role === "assistant");
  const text = last?.content.trim();
  return text ? text : null;
}

function FileIcon({ row }: { row: ReviewRow }) {
  if (row.fileKind === "added") return <FilePlus size={14} className="shrink-0 text-git-added" />;
  if (row.fileKind === "deleted")
    return <FileMinus size={14} className="shrink-0 text-git-deleted" />;
  return <FileText size={14} className="shrink-0 text-fg-muted" />;
}

function ReviewBody({
  session,
  onClose,
  onOpenPullRequest,
}: {
  session: ChatSession;
  onClose: () => void;
  onOpenPullRequest: () => void;
}) {
  const manifest = useAIStore((state) => sessionAgentManifest(state, session.id));
  const environment = useAIStore((state) => sessionEnvironment(session, state.workEnvironments));
  const cwd = useAIStore((state) => {
    const path = sessionCwd(session, state.workEnvironments, session.rootPath);
    return path && path !== "default" ? path : null;
  });
  const { rows } = useReviewRows({ sessionId: session.id, cwd, ownsRun: false });
  const [revision, setRevision] = useState(0);
  const diffs = useSessionDiffs(rows, cwd, revision);
  const [view, setView] = useState<DiffView>("unified");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keptList = useHunkReviewStore((state) => state.kept[session.id] ?? NO_KEYS);
  const undone = useHunkReviewStore((state) => state.undone[session.id] ?? NO_UNDONE);
  const toggleKept = useHunkReviewStore((state) => state.toggleKept);
  const allComments = useReviewCommentsStore((state) => state.comments);
  const addComment = useReviewCommentsStore((state) => state.addComment);
  const updateComment = useReviewCommentsStore((state) => state.updateComment);
  const removeComment = useReviewCommentsStore((state) => state.removeComment);
  const clearComments = useReviewCommentsStore((state) => state.clearSession);
  const taskTitle = useTasksStore(
    (state) => findSessionTask(state.byRoot, session.id)?.title ?? null,
  );
  // A title cut short with an ellipsis makes a poor commit message; the field starts empty then.
  const [message, setMessage] = useState(() => {
    const suggested = commitMessageFor(taskTitle, session.title);
    return suggested.endsWith("…") ? "" : suggested;
  });

  // The agent may still be writing; the diffs follow it while the review is open.
  useEffect(() => {
    const timer = window.setInterval(() => setRevision((value) => value + 1), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const name = manifest?.name ?? "Pragma";
  const title =
    manifest && isGeneratedTerminalTitle(session.title, manifest.name) ? name : session.title;
  const kept = useMemo(() => new Set(keptList), [keptList]);
  const comments = useMemo(
    () => allComments.filter((comment) => comment.sessionId === session.id),
    [allComments, session.id],
  );

  const files = useMemo(
    () =>
      rows
        .filter((row) => row.gitEntry)
        .map((row) => {
          const diff = diffs.get(row.path);
          const hunks = diff ? fileHunks(diff.patchText, diff.original, diff.modified) : [];
          let added = 0;
          let removed = 0;
          for (const hunk of hunks)
            for (const line of hunk.lines) {
              if (line.type === "added") added++;
              if (line.type === "removed") removed++;
            }
          return { row, diff, hunks, added, removed };
        }),
    [rows, diffs],
  );
  const undonePaths = undone.map((item) => item.path);
  const navPaths = [
    ...files.map((file) => file.row.path),
    ...undonePaths.filter((path) => !files.some((file) => file.row.path === path)),
  ].filter((path, index, all) => all.indexOf(path) === index);
  const shownPath = selectedPath && navPaths.includes(selectedPath) ? selectedPath : navPaths[0];
  const shown = files.find((file) => file.row.path === shownPath);
  const shownUndone = undone.filter((item) => item.path === shownPath);
  const liveKeys = files.flatMap((file) => file.hunks.map((hunk) => hunkKey(file.row.path, hunk)));
  const tally = reviewTally(liveKeys, kept, undone);
  const totals = files.reduce(
    (sum, file) => ({ added: sum.added + file.added, removed: sum.removed + file.removed }),
    { added: 0, removed: 0 },
  );
  const summary = lastSummary(session);
  const isWorktree = environment?.kind === "worktree";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const sendFeedback = async () => {
    if (session.kind === "terminal") {
      if (getTerminalEntryStatus(session.id) !== "running") {
        toast.error(`${name} is not running. Open its pane to start it again.`);
        return;
      }
      deliverTerminalPrompt(session.id, buildReviewLine(comments));
      clearComments(session.id);
      toast.success(`Sent your feedback to ${name}`);
      return;
    }
    const sent = await sendToSession(session.id, buildReviewMessage(comments));
    if (!sent) {
      toast.error("Could not send the feedback. Try again once the agent is idle.");
      return;
    }
    clearComments(session.id);
    toast.success(`Sent your feedback to ${name}`);
  };

  const commit = async () => {
    if (!cwd) return;
    const paths = commitPaths(rows);
    if (paths.length === 0 || !message.trim()) return;
    await invoke("git_stage", { repoPath: cwd, paths });
    await invoke("git_commit", { repoPath: cwd, message: message.trim() });
    useHunkReviewStore.getState().clear(session.id);
    if (isWorktree) {
      onClose();
      onOpenPullRequest();
    } else {
      toast.success("Committed the changes");
    }
  };

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 py-4 pr-4 pl-5">
        {manifest ? (
          <AgentMark agentId={manifest.id} name={name} size="lg" />
        ) : (
          <PragmaMark variant="compact" className="size-6.5 shrink-0" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <OverlaySheetTitle className="truncate text-[17px]">{title}</OverlaySheetTitle>
          <span className="truncate text-ui-sm text-fg-muted">
            {name}
            {isWorktree && environment && (
              <>
                {" · "}
                <span className="font-mono text-ui-xs">{environment.branch}</span>
                {environment.baseBranch && (
                  <>
                    {" into "}
                    <span className="font-mono text-ui-xs">{environment.baseBranch}</span>
                  </>
                )}
              </>
            )}
          </span>
        </div>
        <span className="ml-3 flex h-5.5 shrink-0 items-center gap-1.5 rounded-[6px] bg-bg-hover px-2 text-ui-xs text-fg-muted">
          {files.length} {files.length === 1 ? "file" : "files"}
          <span className="font-mono text-git-added">+{totals.added}</span>
          <span className="font-mono text-git-deleted">−{totals.removed}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <SegmentedControl<DiffView>
            label="Diff view"
            value={view}
            onValueChange={setView}
            options={[
              { value: "unified", label: "Unified" },
              { value: "split", label: "Split" },
            ]}
          />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close <Kbd>Esc</Kbd>
          </Button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <nav
          aria-label="Changed files"
          className="flex w-75 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle p-2.5"
        >
          <span className="px-2.5 pt-1 pb-1.5 text-ui-xs font-medium text-fg-subtle">Changed</span>
          {navPaths.length === 0 && (
            <p className="px-2.5 py-2 text-ui-sm text-fg-muted">Nothing changed yet.</p>
          )}
          {navPaths.map((path) => {
            const file = files.find((item) => item.row.path === path);
            return (
              <Button
                key={path}
                variant="ghost"
                size="sm"
                title={path}
                onClick={() => setSelectedPath(path)}
                className={cn(
                  "h-8 min-w-0 justify-start gap-2 px-2.5 font-normal text-fg-default",
                  path === shownPath && "bg-bg-active",
                )}
              >
                {file ? <FileIcon row={file.row} /> : <FileText size={14} className="shrink-0" />}
                <span className="min-w-0 flex-1 truncate text-left font-mono text-ui-xs">
                  {path.split("/").pop()}
                </span>
                {file && (
                  <span className="flex shrink-0 gap-1.5 font-mono text-ui-2xs">
                    <span className="text-git-added">+{file.added}</span>
                    <span className="text-git-deleted">−{file.removed}</span>
                  </span>
                )}
              </Button>
            );
          })}
          {summary && (
            <section className="mt-3 flex flex-col gap-1.5 rounded-[10px] bg-bg-well p-3 text-ui-sm leading-relaxed text-fg-muted">
              <span className="text-ui-xs font-medium text-fg-subtle">{name}'s summary</span>
              <p className="line-clamp-8 whitespace-pre-wrap">{summary}</p>
            </section>
          )}
          <section className="mt-2 flex flex-col gap-1 rounded-[10px] bg-bg-well p-3 text-ui-sm text-fg-muted">
            <span className="text-ui-xs font-medium text-fg-subtle">Your review</span>
            <span>
              <span className="text-fg-default">{tally.kept}</span> of {tally.total}{" "}
              {tally.total === 1 ? "part" : "parts"} kept
            </span>
            <span>
              <span className="text-fg-default">{tally.undone}</span> undone ·{" "}
              <span className="text-fg-default">{comments.length}</span>{" "}
              {comments.length === 1 ? "comment" : "comments"}
            </span>
          </section>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-4.5 py-3">
          {view === "split" && shown?.diff ? (
            <InlineDiff
              original={shown.diff.original}
              modified={shown.diff.modified}
              patchText={shown.diff.patchText}
              filePath={shown.row.path}
              viewMode="split"
              onViewModeChange={(mode) => setView(mode === "split" ? "split" : "unified")}
              className="h-auto min-h-0 flex-1"
            />
          ) : (
            <>
              {shownPath && (
                <span className="truncate font-mono text-ui-xs text-fg-muted">{shownPath}</span>
              )}
              {shown?.hunks.map((hunk) => {
                const key = hunkKey(shown.row.path, hunk);
                return (
                  <ReviewHunkCard
                    key={key}
                    header={hunk.header}
                    showContext={!PROSE_OR_DATA.test(shown.row.path)}
                    lines={hunk.lines}
                    state={kept.has(key) ? "kept" : "open"}
                    busy={busy}
                    comments={comments.filter((comment) => comment.path === shown.row.path)}
                    onKeep={() => toggleKept(session.id, key)}
                    onUndo={() =>
                      void run(() =>
                        undoHunk({
                          sessionId: session.id,
                          cwd: cwd ?? "",
                          path: shown.row.path,
                          hunk,
                          untracked: shown.row.gitEntry?.status_code === "?",
                        }),
                      )
                    }
                    onComment={(side, line, code, body) =>
                      addComment({
                        sessionId: session.id,
                        path: shown.row.path,
                        side,
                        line,
                        code,
                        body,
                      })
                    }
                    onUpdateComment={updateComment}
                    onRemoveComment={removeComment}
                  />
                );
              })}
              {shownUndone.map((item) => (
                <ReviewHunkCard
                  key={item.key}
                  header={item.header}
                  showContext={!PROSE_OR_DATA.test(item.path)}
                  lines={item.lines}
                  state="undone"
                  busy={busy}
                  comments={[]}
                  onRestore={() => void run(() => restoreHunk(session.id, cwd ?? "", item))}
                  onComment={() => {}}
                  onUpdateComment={updateComment}
                  onRemoveComment={removeComment}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <footer className="flex h-15 shrink-0 items-center gap-2.5 border-t border-border-subtle bg-bg-hover/40 pr-3.5 pl-5">
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Commit message"
          aria-label="Commit message"
          className="h-8.5 max-w-130 flex-1 font-mono text-ui-xs"
        />
        <span className="shrink-0 text-ui-sm text-fg-muted">
          {tally.total === 0
            ? "Nothing to review"
            : tally.open > 0
              ? `${tally.open} ${tally.open === 1 ? "part" : "parts"} still open`
              : "Everything reviewed"}
        </span>
        <span className="ml-auto flex shrink-0 gap-2">
          <Button
            variant="secondary"
            disabled={comments.length === 0}
            title={comments.length === 0 ? "Comment on a line first" : undefined}
            onClick={() => void sendFeedback()}
          >
            <PaperPlaneRight size={13} aria-hidden="true" />
            Send feedback to {name}
          </Button>
          <Button
            disabled={busy || files.length === 0 || !message.trim()}
            onClick={() => void run(commit)}
          >
            <GitPullRequest size={13} aria-hidden="true" />
            {isWorktree ? "Commit and open PR" : "Commit"}
          </Button>
        </span>
      </footer>
    </>
  );
}

/// What an agent changed, part by part: keep, undo or comment, then commit or send the comments back.
export function ReviewOverlay() {
  const active = useOverlayStore((state) => state.active);
  const target = useOverlayStore((state) => state.target);
  const close = useOverlayStore((state) => state.close);
  const session = useAIStore((state) =>
    target ? state.chatSessions.find((item) => item.id === target) : undefined,
  );
  const [shown, setShown] = useState<ChatSession | undefined>(session);
  if (session && session !== shown) setShown(session);
  const open = active === "review" && session !== undefined;
  // Outside the sheet, so the pull request dialog stays after the review closes.
  const finishWorktree = useFinishWorktree(shown?.rootPath ?? "default");

  return (
    <>
      <OverlaySheet open={open} onOpenChange={(next) => !next && close("review")}>
        <OverlaySheetContent placement="workspace">
          {shown && (
            <ReviewBody
              key={shown.id}
              session={shown}
              onClose={() => close("review")}
              onOpenPullRequest={() => finishWorktree.finish(shown.id, "pull-request")}
            />
          )}
        </OverlaySheetContent>
      </OverlaySheet>
      {finishWorktree.dialogs}
    </>
  );
}
