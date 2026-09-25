import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAgentStore } from "@/features/agent/store";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { EditorEmptyState } from "./EditorEmptyState";
import { ReferencesView } from "./ReferencesView";
import { InlineDiff } from "./InlineDiff";
import { FileEditor } from "./FileEditor";

interface EditorProps {
  panelId?: string;
}

export function Editor({ panelId }: EditorProps) {
  const { tabs, getPanelActiveTabId, updateFileContent, closeTab } = useEditorStore();
  const vimEnabled = useSettingsStore((state) => state.editor.vimMode);

  const activeTabId = getPanelActiveTabId(panelId ?? null);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  if (!activeTab) {
    return <EditorEmptyState />;
  }

  if (activeTab.kind === "diff") {
    const isAiEdit = !!activeTab.sourceTabId;
    const isAgentReview = activeTab.agentReviewId !== undefined && !activeTab.agentApplied;

    const handleAccept = (modified: string) => {
      if (activeTab.agentReviewId) {
        useAgentStore.getState().resolveEditReview(activeTab.agentReviewId, true);
        return;
      }
      if (activeTab.sourceTabId) {
        updateFileContent(activeTab.sourceTabId, modified);
      }
      closeTab(activeTab.id);
      useAIEditStore.getState().acceptEdit();
    };

    const handleReject = () => {
      if (activeTab.agentReviewId) {
        useAgentStore.getState().resolveEditReview(activeTab.agentReviewId, false);
        return;
      }
      closeTab(activeTab.id);
      useAIEditStore.getState().rejectEdit();
    };

    const showActions = isAiEdit || isAgentReview;

    return (
      <div className="flex h-full w-full flex-col">
        <div className="relative min-h-0 flex-1">
          <InlineDiff
            original={activeTab.original}
            modified={activeTab.modified}
            patchText={activeTab.patchText}
            filePath={activeTab.path}
            onAccept={showActions ? handleAccept : undefined}
            onReject={showActions ? handleReject : undefined}
          />
        </div>
      </div>
    );
  }

  if (activeTab.kind === "references") {
    return <ReferencesView tab={activeTab} />;
  }

  return (
    <FileEditor
      content={activeTab.content}
      fileName={activeTab.name}
      filePath={activeTab.path}
      tabId={activeTab.id}
      isModified={activeTab.isModified}
      onChange={(value) => updateFileContent(activeTab.id, value)}
      vimEnabled={vimEnabled}
    />
  );
}
