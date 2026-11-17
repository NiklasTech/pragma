import { type GitStatusEntry } from "@/shared/stores/git";
import { FileRow } from "./FileRow";
import { CleanTreeHint } from "./CleanTreeHint";
import { ConflictFileRow } from "../ConflictFileRow";
import { type GitRow } from "./rows";

export interface GitStatusRowActions {
  actionBusy: string | null;
  onOpenConflict: (path: string) => void;
  onStage: (entry: GitStatusEntry) => void;
  onUnstage: (entry: GitStatusEntry) => void;
  onSelectFile: (entry: GitStatusEntry) => void;
  onOpenDiff: (entry: GitStatusEntry, staged: boolean) => void;
  onDiscard: (entry: GitStatusEntry) => void;
  isSelected: (path: string) => boolean;
  repoLabel: string;
}

export function GitStatusRow({ row, ...actions }: { row: GitRow } & GitStatusRowActions) {
  if (row.kind === "conflict-header") {
    return (
      <div className="flex h-7 items-end gap-2 px-3 pb-1">
        <span
          title="Conflicts to resolve"
          className="inline-flex size-4 items-center justify-center rounded-[3px] bg-status-error/15 font-mono text-[10px] font-bold text-status-error"
        >
          !
        </span>
        <span className="font-mono text-[10.5px] text-fg-subtle tabular-nums">{row.count}</span>
      </div>
    );
  }

  if (row.kind === "conflict-entry") {
    return <ConflictFileRow entry={row.entry} onOpen={(e) => actions.onOpenConflict(e.path)} />;
  }

  if (row.kind === "file") {
    return (
      <FileRow
        entry={row.entry}
        isSelected={actions.isSelected(row.entry.path)}
        actionBusy={actions.actionBusy}
        onStage={actions.onStage}
        onUnstage={actions.onUnstage}
        onSelect={actions.onSelectFile}
        onOpenDiff={actions.onOpenDiff}
        onDiscard={actions.onDiscard}
      />
    );
  }

  return <CleanTreeHint repoLabel={actions.repoLabel} />;
}
