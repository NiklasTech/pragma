import { Spinner } from "@phosphor-icons/react";
import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";

export default function AIDiffPanel() {
  const edit = useAIEditStore((s) => s.edit);
  const proposedCode = useAIEditStore((s) => s.proposedCode);
  const acceptEdit = useAIEditStore((s) => s.acceptEdit);
  const rejectEdit = useAIEditStore((s) => s.rejectEdit);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);

  if (!edit) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
        <span>No active AI edit</span>
        <span className="text-ui-xs">Select code in the editor and choose “Edit with AI”.</span>
      </div>
    );
  }

  if (edit.status === "composing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
        <span>Composing prompt…</span>
        <span className="text-ui-xs">Type your instructions in the AI chat.</span>
      </div>
    );
  }

  if (edit.status === "awaiting") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-ui-sm text-fg-muted">
        <Spinner size={16} className="animate-spin" />
        <span>Waiting for AI proposal…</span>
      </div>
    );
  }

  const handleAccept = (modified: string) => {
    updateFileContent(edit.fileTabId, modified);
    acceptEdit();
  };

  const handleReject = () => {
    rejectEdit();
  };

  return (
    <div className="h-full w-full">
      <InlineDiff
        original={edit.originalCode}
        modified={proposedCode ?? edit.originalCode}
        filePath={edit.filePath}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </div>
  );
}
