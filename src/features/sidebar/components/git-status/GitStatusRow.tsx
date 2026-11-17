import { type GitStatusEntry } from "@/shared/stores/git";
import { SectionHeader } from "./SectionHeader";
import { FileRow } from "./FileRow";
import { CleanTreeHint } from "./CleanTreeHint";
import { HistoryHeader } from "./HistoryHeader";
import { HistoryEntry } from "./HistoryEntry";
import { ConflictFileRow } from "../ConflictFileRow";
import { type GitRow } from "./rows";

export function GitStatusRow({
  row,
  actionBusy,
  onOpenConflict,
  historyExpanded,
  onToggleHistory,
  onStageAll,
  onUnstageAll,
  onToggleStaged,
  onToggleUnstaged,
  onSelectFile,
  onOpenDiff,
  onDiscard,
  isSelected,
  repoLabel,
}: {
  row: GitRow;
  actionBusy: string | null;
  onOpenConflict: (path: string) => void;
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onToggleStaged: (entry: GitStatusEntry) => void;
  onToggleUnstaged: (entry: GitStatusEntry) => void;
  onSelectFile: (entry: GitStatusEntry) => void;
  onOpenDiff: (entry: GitStatusEntry, staged: boolean) => void;
  onDiscard: (entry: GitStatusEntry) => void;
  isSelected: (path: string) => boolean;
  repoLabel: string;
}) {
  if (row.kind === "conflict-header") {
    return (
      <div className="flex h-6 items-center gap-2 px-3">
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-status-error uppercase">
          Conflicts
        </span>
        <span className="text-ui-xs tabular-nums text-fg-muted">{row.count}</span>
      </div>
    );
  }

  if (row.kind === "conflict-entry") {
    return <ConflictFileRow entry={row.entry} onOpen={(e) => onOpenConflict(e.path)} />;
  }

  if (row.kind === "history-header") {
    return <HistoryHeader expanded={historyExpanded} onToggle={onToggleHistory} />;
  }

  if (row.kind === "staged-header") {
    return (
      <SectionHeader
        title="Staged"
        count={row.count}
        actionBusy={actionBusy}
        onUnstageAll={onUnstageAll}
        mode="staged"
      />
    );
  }

  if (row.kind === "unstaged-header") {
    return (
      <SectionHeader
        title="Changes"
        count={row.count}
        actionBusy={actionBusy}
        onStageAll={onStageAll}
        mode="unstaged"
      />
    );
  }

  if (row.kind === "staged-entry") {
    return (
      <FileRow
        entry={row.entry}
        isSelected={isSelected(row.entry.path)}
        actionBusy={actionBusy}
        mode="staged"
        onToggle={onToggleStaged}
        onSelect={onSelectFile}
        onOpenDiff={(e) => onOpenDiff(e, true)}
      />
    );
  }

  if (row.kind === "unstaged-entry") {
    return (
      <FileRow
        entry={row.entry}
        isSelected={isSelected(row.entry.path)}
        actionBusy={actionBusy}
        mode="unstaged"
        onToggle={onToggleUnstaged}
        onSelect={onSelectFile}
        onOpenDiff={(e) => onOpenDiff(e, false)}
        onDiscard={onDiscard}
      />
    );
  }

  if (row.kind === "clean-hint") {
    return <CleanTreeHint repoLabel={repoLabel} />;
  }

  if (row.kind === "history-entry") {
    return <HistoryEntry commit={row.commit} />;
  }

  return null;
}
