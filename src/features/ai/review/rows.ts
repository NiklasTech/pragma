import type { AgentEditReview } from "@/features/agent/store";
import type { GitStatusEntry } from "@/shared/stores/git";

export type ReviewFileKind = "added" | "modified" | "deleted";

export function reviewKind(statusCode: string): ReviewFileKind {
  if (statusCode === "?" || statusCode === "A") return "added";
  if (statusCode === "D") return "deleted";
  return "modified";
}

export function editKind(originalContent: string, content: string): ReviewFileKind {
  if (originalContent.length === 0 && content.length > 0) return "added";
  if (content.length === 0 && originalContent.length > 0) return "deleted";
  return "modified";
}

export function relativePath(absolutePath: string, cwd: string): string {
  const root = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalized = absolutePath.replace(/\\/g, "/");
  if (!root) return normalized;
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

export function joinPath(cwd: string, path: string): string {
  return cwd.endsWith("/") ? `${cwd}${path}` : `${cwd}/${path}`;
}

export interface ReviewRow {
  id: string;
  sessionId: string;
  path: string;
  absolutePath: string;
  fileKind: ReviewFileKind;
  source: "git" | "edit";
  gitEntry?: GitStatusEntry;
  editReview?: AgentEditReview;
}

export function buildReviewRows(input: {
  sessionId: string;
  cwd: string;
  entries: GitStatusEntry[];
  editReviews: AgentEditReview[];
}): ReviewRow[] {
  const { sessionId, cwd, entries, editReviews } = input;

  const editRows: ReviewRow[] = editReviews.map((review) => ({
    id: `${sessionId}:edit:${review.toolCallId}`,
    sessionId,
    path: relativePath(review.path, cwd),
    absolutePath: review.path,
    fileKind: editKind(review.originalContent, review.content),
    source: "edit",
    editReview: review,
  }));

  const editPaths = new Set(editRows.map((row) => row.path));
  const gitRows: ReviewRow[] = entries
    .filter((entry) => !editPaths.has(entry.path))
    .map((entry) => ({
      id: `${sessionId}:git:${entry.path}`,
      sessionId,
      path: entry.path,
      absolutePath: joinPath(cwd, entry.path),
      fileKind: reviewKind(entry.status_code),
      source: "git",
      gitEntry: entry,
    }));

  return [...editRows, ...gitRows];
}
