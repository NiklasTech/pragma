import { toast } from "sonner";

import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import {
  loadReviewComments,
  type GhPullRequest,
  type GhReviewComment,
} from "@/shared/stores/github";
import { useUiModeStore } from "@/shell/mode";
import { runTask } from "@/features/ai/tasks/actions";
import { useTasksStore } from "@/features/ai/tasks/store";
import type { Task } from "@/features/ai/tasks/types";
import { TASK_NOTES_MAX } from "@/features/ai/tasks/validation";

const TRUNCATED_NOTE = "\n\n[Truncated. See the pull request for the remaining comments.]";

function commentHeading(comment: GhReviewComment): string {
  if (comment.path) {
    const location = comment.line ? `${comment.path}:${comment.line}` : comment.path;
    return `${location} (${comment.author})`;
  }
  const state = comment.state ? `, ${comment.state.toLowerCase().replace(/_/g, " ")}` : "";
  return `Review by ${comment.author}${state}`;
}

export function buildReviewTaskNotes(pr: GhPullRequest, comments: GhReviewComment[]): string {
  const intro = `Address the review comments on pull request #${pr.number} (${pr.url}).`;
  const sections = comments.map((comment) => `${commentHeading(comment)}:\n${comment.body.trim()}`);
  const notes = [intro, ...sections].join("\n\n");
  if (notes.length <= TASK_NOTES_MAX) return notes;
  return notes.slice(0, TASK_NOTES_MAX - TRUNCATED_NOTE.length) + TRUNCATED_NOTE;
}

export async function sendReviewCommentsToAgent(
  repoPath: string,
  pr: GhPullRequest,
): Promise<void> {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) {
    toast.error("Open a folder to start an agent session");
    return;
  }

  let comments: GhReviewComment[];
  try {
    comments = await loadReviewComments(repoPath, pr.number);
  } catch (err) {
    toast.error(String(err));
    return;
  }
  if (comments.length === 0) {
    toast.info(`Pull request #${pr.number} has no review comments`);
    return;
  }

  const tasks = useTasksStore.getState();
  if (tasks.rootPath !== rootPath || !tasks.loaded) await tasks.load(rootPath);
  if (!useTasksStore.getState().loaded) {
    toast.error("Could not load the task board");
    return;
  }

  const now = Date.now();
  const task: Task = {
    id: crypto.randomUUID(),
    title: `Address review comments on PR #${pr.number}`,
    notes: buildReviewTaskNotes(pr, comments),
    status: "todo",
    result: "",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await useTasksStore.getState().saveTask(task);
  } catch {
    toast.error("Could not save the task");
    return;
  }

  useUiModeStore.getState().setUiMode("agents");
  await runTask(rootPath, task);
}
