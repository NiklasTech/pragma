import { GitMerge } from "@phosphor-icons/react";
import type { GitStatusEntry } from "@/shared/stores/git";
import { basename, dirname } from "./git-status/utils";

export function ConflictFileRow({
  entry,
  onOpen,
}: {
  entry: GitStatusEntry;
  onOpen: (entry: GitStatusEntry) => void;
}) {
  const fileName = basename(entry.path);
  const dir = dirname(entry.path);

  return (
    <div className="flex h-9 items-center gap-2 rounded-md pl-2 pr-2 transition-colors hover:bg-bg-hover">
      <GitMerge size={15} className="shrink-0 text-status-error" />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
        <span className="truncate text-ui-base leading-tight">{fileName}</span>
        {dir && <span className="truncate text-ui-sm text-fg-muted">{dir}</span>}
      </div>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="shrink-0 rounded px-1.5 py-0.5 text-ui-xs text-status-error transition-colors hover:bg-status-error/10"
      >
        Resolve
      </button>
    </div>
  );
}
