import { parse as parseYaml } from "yaml";

import { clip } from "./githubImport";
import { parseLabels, TASK_LABEL_MAX, TASK_LABELS_MAX, TASK_PRIORITIES } from "./organize";
import type { Task, TaskPriority } from "./types";
import { TASK_NOTES_MAX, TASK_TITLE_MAX } from "./validation";

export interface MarkdownFile {
  /** Workspace-relative path with forward slashes. */
  path: string;
  content: string;
}

interface FrontMatter {
  labels: string[];
  priority?: TaskPriority;
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const HEADING_PATTERN = /^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE_PATTERN = /^ {0,3}(```|~~~)/;

export function isMarkdownPath(path: string): boolean {
  return /\.md$/i.test(path);
}

/// Markdown files that no task links to yet.
export function importableMarkdownPaths(paths: string[], tasks: Task[]): string[] {
  const linked = new Set(tasks.map((task) => task.sourcePath).filter(Boolean));
  return paths.filter((path) => isMarkdownPath(path) && !linked.has(path));
}

function readFrontMatter(block: string): FrontMatter {
  let value: unknown;
  try {
    value = parseYaml(block);
  } catch {
    return { labels: [] };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { labels: [] };
  const fields: Record<string, unknown> = { ...value };
  const rawLabels = Array.isArray(fields.labels)
    ? fields.labels.filter((label): label is string => typeof label === "string")
    : typeof fields.labels === "string"
      ? [fields.labels]
      : [];
  const labels = parseLabels(rawLabels.join(","))
    .filter((label) => label.length <= TASK_LABEL_MAX)
    .slice(0, TASK_LABELS_MAX);
  const priority = TASK_PRIORITIES.find((option) => option.value === fields.priority)?.value;
  return priority ? { labels, priority } : { labels };
}

/// The first level-one heading outside code fences and the text after it.
function splitTitle(body: string): { title: string; notes: string } | null {
  const lines = body.split(/\r?\n/);
  let fence: string | null = null;
  for (const [index, line] of lines.entries()) {
    const marker = FENCE_PATTERN.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = HEADING_PATTERN.exec(line)?.[1]?.trim();
    if (heading) return { title: heading, notes: lines.slice(index + 1).join("\n") };
  }
  return null;
}

function fileTitle(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "") || name;
}

/// A Todo task for `file`, shortened to the task limits and linked back to the file.
export function markdownToTask(file: MarkdownFile, now: number): Task {
  const match = FRONT_MATTER_PATTERN.exec(file.content);
  const frontMatter = match ? readFrontMatter(match[1]) : { labels: [] };
  const body = match ? file.content.slice(match[0].length) : file.content;
  const split = splitTitle(body);
  const task: Task = {
    id: crypto.randomUUID(),
    title: clip(split?.title ?? fileTitle(file.path), TASK_TITLE_MAX).trim(),
    notes: clip((split?.notes ?? body).trim(), TASK_NOTES_MAX),
    status: "todo",
    result: "",
    sourcePath: file.path,
    createdAt: now,
    updatedAt: now,
  };
  if (frontMatter.labels.length > 0) task.labels = frontMatter.labels;
  if (frontMatter.priority) task.priority = frontMatter.priority;
  return task;
}
