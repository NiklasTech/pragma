export interface GitLogEntry {
  sha: string;
  short_sha: string;
  author: string;
  author_email: string;
  timestamp_secs: number;
  parents: string[];
  subject: string;
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
  | "reset-hard";

export interface ConfirmDialogState {
  type: ConfirmDialogType;
  sha: string;
  title: string;
  description: string;
}
