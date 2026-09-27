import { useCallback } from "react";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useUiModeStore } from "@/shell/mode";

import { openWorkspaceFile } from "@/features/ai/components/openWorkspaceFile";

import { ReviewFileList } from "./ReviewFileList";
import type { ReviewRow } from "./rows";

export function ReviewFilesList({
  rows,
  error,
  selectedRowId,
  onSelectRow,
}: {
  rows: ReviewRow[];
  error: string | null;
  selectedRowId: string | null;
  onSelectRow: (row: ReviewRow) => void;
}) {
  const editorPanelId = useEditorPanelId();
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  const activate = useCallback(
    async (row: ReviewRow) => {
      onSelectRow(row);
      if (await openWorkspaceFile(row.absolutePath, editorPanelId)) setUiMode("editor");
    },
    [editorPanelId, onSelectRow, setUiMode],
  );

  if (error) {
    return <p className="px-3 py-4 text-center text-ui-xs text-status-error">{error}</p>;
  }

  return (
    <ReviewFileList
      rows={rows}
      selectedRowId={selectedRowId}
      onActivate={(row) => void activate(row)}
      emptyText="No files changed in this session."
    />
  );
}
