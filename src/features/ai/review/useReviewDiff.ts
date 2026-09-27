import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import type { GitDiffContentResult } from "@/shared/stores/git";

import type { ReviewRow } from "./rows";

export interface ReviewDiffData {
  original: string;
  modified: string;
  patchText: string;
}

export type ReviewDiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: ReviewDiffData }
  | { status: "error"; message: string };

interface FileReadResult {
  content: string;
}

async function loadWrittenDiff(cwd: string, row: ReviewRow): Promise<ReviewDiffData> {
  const entry = row.gitEntry;
  if (!entry) return { original: "", modified: "", patchText: "" };

  const staged = entry.is_staged && !entry.is_unstaged;
  try {
    const result = await invoke<GitDiffContentResult>("git_diff_content", {
      repoPath: cwd,
      path: entry.path,
      staged,
      originalPath: entry.original_path,
    });
    return {
      original: result.original_content,
      modified: result.modified_content,
      patchText: result.fallback_patch,
    };
  } catch (err) {
    if (entry.status_code !== "?") throw err;
    const file = await invoke<FileReadResult>("read_text_file", {
      path: row.absolutePath,
    });
    return { original: "", modified: file.content, patchText: "" };
  }
}

export function useReviewDiff(row: ReviewRow | null, cwd: string): ReviewDiffState {
  const [state, setState] = useState<ReviewDiffState>({ status: "idle" });

  useEffect(() => {
    if (!row) {
      setState({ status: "idle" });
      return;
    }

    if (row.editReview) {
      setState({
        status: "loaded",
        data: {
          original: row.editReview.originalContent,
          modified: row.editReview.content,
          patchText: "",
        },
      });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void loadWrittenDiff(cwd, row)
      .then((data) => {
        if (!cancelled) setState({ status: "loaded", data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", message: String(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [row, cwd]);

  return state;
}
