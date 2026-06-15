import { useEffect, useRef } from "react";
import { TabBar } from "@/features/editor/components/TabBar";
import { Editor } from "@/features/editor/components/Editor";
import { useEditorStore } from "@/shared/stores/editor";

interface EditorPanelProps {
  panelId: string;
}

export default function EditorPanel({ panelId }: EditorPanelProps) {
  const setLastFocusedPanelId = useEditorStore((s) => s.setLastFocusedPanelId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const getPanelActiveTabId = useEditorStore((s) => s.getPanelActiveTabId);
  const containerRef = useRef<HTMLDivElement>(null);

  const syncGlobalActive = () => {
    setLastFocusedPanelId(panelId);
    const panelActive = getPanelActiveTabId(panelId);
    if (panelActive) {
      setActiveTab(panelActive);
    }
  };

  useEffect(() => {
    syncGlobalActive();
  }, [panelId]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col"
      onFocus={syncGlobalActive}
      onClick={syncGlobalActive}
      tabIndex={-1}
    >
      <TabBar panelId={panelId} />
      <div className="min-h-0 flex-1">
        <Editor panelId={panelId} />
      </div>
    </div>
  );
}
