export interface GitLogEntry {
  sha: string;
  short_sha: string;
  author: string;
  author_email: string;
  timestamp_secs: number;
  parents: string[];
  subject: string;
  tags: string[];
  files_changed: number;
  insertions: number;
  deletions: number;
}

export type LoadStatus = "idle" | "initial" | "more" | "error";

export type ConfirmDialogType =
  | "checkout"
  | "cherry-pick"
  | "revert"
  | "reset-soft"
  | "reset-mixed"
  | "reset-hard"
  | "delete-tag";

export interface ConfirmDialogState {
  type: ConfirmDialogType;
  sha: string;
  tag?: string;
  title: string;
  description: string;
}
