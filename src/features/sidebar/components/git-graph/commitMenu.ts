import type { ActionMenuSpec } from "@/shared/components/ui/action-menu";

import { useGitCompareDialog } from "../../lib/gitDialogs";
import type { GitLogEntry } from "./types";

export interface CommitMenuActions {
  onViewDetails: (sha: string) => void;
  onCopySha: (sha: string) => void;
  onCheckout: (sha: string) => void;
  onCreateBranch: (sha: string) => void;
  onCherryPick: (sha: string) => void;
  onRevert: (sha: string) => void;
  onReset: (sha: string, mode: "soft" | "mixed" | "hard") => void;
  onCreateTag: (sha: string) => void;
  onDeleteTag: (tag: string) => void;
}

/// Right-click on a commit: look at it, branch or tag from it, and apply or undo it.
export function commitMenu(commit: GitLogEntry, actions: CommitMenuActions): ActionMenuSpec {
  return {
    head: `${commit.short_sha} · ${commit.subject}`,
    tone: "idle",
    groups: [
      {
        items: [
          {
            key: "v",
            label: "view details",
            shortcut: "⏎",
            onSelect: () => actions.onViewDetails(commit.sha),
          },
          { key: "c", label: "copy sha", onSelect: () => actions.onCopySha(commit.sha) },
          {
            key: "d",
            label: "compare with head",
            onSelect: () => useGitCompareDialog.getState().show(commit.sha, "HEAD"),
          },
        ],
      },
      {
        items: [
          { key: "o", label: "checkout commit", onSelect: () => actions.onCheckout(commit.sha) },
          {
            key: "b",
            label: "create branch here",
            onSelect: () => actions.onCreateBranch(commit.sha),
          },
          { key: "t", label: "create tag", onSelect: () => actions.onCreateTag(commit.sha) },
          { key: "p", label: "cherry-pick", onSelect: () => actions.onCherryPick(commit.sha) },
          { key: "r", label: "revert", onSelect: () => actions.onRevert(commit.sha) },
        ],
      },
      {
        label: "reset to here",
        items: [
          { key: "s", label: "reset soft", onSelect: () => actions.onReset(commit.sha, "soft") },
          { key: "m", label: "reset mixed", onSelect: () => actions.onReset(commit.sha, "mixed") },
          {
            key: "h",
            label: "reset hard",
            danger: true,
            onSelect: () => actions.onReset(commit.sha, "hard"),
          },
        ],
      },
      {
        items: commit.tags.map((tag, index) => ({
          key: index === 0 ? "x" : String(index),
          label: `delete tag ${tag}`,
          danger: true,
          onSelect: () => actions.onDeleteTag(tag),
        })),
      },
    ],
  };
}
