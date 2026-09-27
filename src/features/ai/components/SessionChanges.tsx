import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import { openGitDiffInSplit } from "@/features/sidebar/lib/gitDiffSplit";
import { statusLetter } from "@/features/sidebar/components/git-status/FileRow";
import { basename, dirname } from "@/features/sidebar/components/git-status/utils";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { parseDiffToSides } from "@/shared/lib/diff";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { cn } from "@/shared/lib/utils";
import type { GitStatusEntry, GitStatusSnapshot } from "@/shared/stores/git";
import { useUiModeStore } from "@/shell/mode";

import { openWorkspaceFile } from "./openWorkspaceFile";

const REFRESH_MS = 4000;

/// Git changes in a session's folder; works for any agent because it reads the worktree itself.
export function useSessionChanges(cwd: string | null): {
  entries: GitStatusEntry[];
  error: string | null;
} {
  const [entries, setEntries] = useState<GitStatusEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) {
      setEntries([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { snapshot } = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", {
          repoPath: cwd,
        });
        if (cancelled) return;
        setEntries(snapshot.changed_files);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cwd]);

  return { entries, error };
}

export function SessionChanges({ cwd, action }: { cwd: string; action: "diff" | "open" }) {
  const { entries, error } = useSessionChanges(cwd);
  const editorPanelId = useEditorPanelId();
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  const open = useCallback(
    async (entry: GitStatusEntry) => {
      const absolute = `${cwd}/${entry.path}`;
      if (action === "diff") {
        const staged = entry.is_staged && !entry.is_unstaged;
        const { diff_text: patch } = await invoke<{ diff_text: string }>("git_diff", {
          repoPath: cwd,
          path: entry.path,
          staged,
        });
        if (patch.trim()) {
          const { original, modified } = parseDiffToSides(patch);
          openGitDiffInSplit(editorPanelId, {
            id: `diff:${absolute}:${staged ? "staged" : "unstaged"}`,
            path: absolute,
            original,
            modified,
            patchText: patch,
            staged,
          });
          setUiMode("editor");
          return;
        }
      }
      if (await openWorkspaceFile(absolute, editorPanelId)) setUiMode("editor");
    },
    [action, cwd, editorPanelId, setUiMode],
  );

  if (error) {
    return <p className="px-3 py-4 text-center text-ui-xs text-status-error">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-ui-xs text-fg-subtle">
        No changes in this session's folder.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-1.5">
      <p className="px-1.5 pt-1 pb-1.5 text-ui-2xs text-fg-subtle">
        {entries.length === 1 ? "1 changed file" : `${entries.length} changed files`}
        {action === "diff" ? " · click to review the diff" : ""}
      </p>
      {entries.map((entry) => {
        const letter = statusLetter(entry.status_code);
        const dir = dirname(entry.path);
        return (
          <button
            key={entry.path}
            type="button"
            onClick={() => void open(entry)}
            title={entry.path}
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-hover"
          >
            <img src={getFileIconPath(basename(entry.path))} alt="" className="size-3.5 shrink-0" />
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="truncate text-ui-xs text-fg-default">{basename(entry.path)}</span>
              {dir && <span className="truncate text-ui-2xs text-fg-subtle">{dir}</span>}
            </span>
            <span
              className={cn("w-3 shrink-0 text-center font-mono text-ui-2xs", letter.className)}
            >
              {letter.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
