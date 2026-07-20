import { type GitCommit } from "@/shared/stores/git";
import { formatRelativeTime, shortSha } from "./utils";

export function HistoryEntry({ commit }: { commit: GitCommit }) {
  return (
    <div
      className="group mx-1 flex flex-col gap-0.5 rounded-md px-3 py-1.5 hover:bg-bg-hover"
      title={commit.message}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-mono text-ui-xs text-fg-subtle">{shortSha(commit.id)}</span>
        <span className="truncate text-ui-sm text-fg-default/90">
          {commit.message.split("\n")[0]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-ui-xs text-fg-subtle">
        <span className="truncate">{commit.author}</span>
        <span>·</span>
        <span>{formatRelativeTime(commit.time)}</span>
      </div>
    </div>
  );
}
