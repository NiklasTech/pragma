import type { GitStatusSnapshot } from "@/shared/stores/git/types";

export type GitDecorationKind = "added" | "modified" | "deleted" | "untracked" | "conflict";

export interface GitDecoration {
  kind: GitDecorationKind;
  letter: string;
}

export interface GitDecorations {
  files: Map<string, GitDecoration>;
  dirtyDirs: Set<string>;
}

function decorationFor(code: string, conflicted: boolean): GitDecoration {
  if (conflicted || code === "U") return { kind: "conflict", letter: "!" };
  switch (code) {
    case "?":
      return { kind: "untracked", letter: "U" };
    case "A":
      return { kind: "added", letter: "A" };
    case "D":
      return { kind: "deleted", letter: "D" };
    case "R":
      return { kind: "modified", letter: "R" };
    default:
      return { kind: "modified", letter: "M" };
  }
}

/// Maps git status entries onto absolute tree paths, marking every ancestor folder as dirty.
export function buildGitDecorations(snapshot: GitStatusSnapshot | null): GitDecorations {
  const files = new Map<string, GitDecoration>();
  const dirtyDirs = new Set<string>();
  if (!snapshot) return { files, dirtyDirs };

  const root = snapshot.repo.repo_root.replace(/[\\/]+$/, "");
  for (const entry of snapshot.changed_files) {
    const relative = entry.path.replace(/\\/g, "/").replace(/\/$/, "");
    const absolute = `${root}/${relative}`;
    files.set(absolute, decorationFor(entry.status_code, entry.is_conflicted));

    const segments = relative.split("/");
    for (let i = 1; i < segments.length; i++) {
      dirtyDirs.add(`${root}/${segments.slice(0, i).join("/")}`);
    }
  }

  return { files, dirtyDirs };
}
