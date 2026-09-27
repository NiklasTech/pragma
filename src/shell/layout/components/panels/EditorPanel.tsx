import { useEffect, useRef } from "react";
import { TabBar } from "@/features/editor/components/TabBar";
import { EditorBreadcrumb } from "@/features/editor/components/EditorBreadcrumb";
import { Editor } from "@/features/editor/components/Editor";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout/store";
import { findPanelByKind } from "@/shell/layout/tree/operations";

interface EditorPanelProps {
  panelId: string;
}

export default function EditorPanel({ panelId }: EditorPanelProps) {
  const setLastFocusedPanelId = useEditorStore((s) => s.setLastFocusedPanelId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const getPanelActiveTabId = useEditorStore((s) => s.getPanelActiveTabId);
  const hasTabs = useEditorStore((s) => s.tabs.length > 0);
  const hasHydrated = useEditorStore((s) => s._hasHydrated);
  const isExtraEditor = useLayoutStore((s) => findPanelByKind(s.root, "editor")?.id !== panelId);
  const closePanel = useLayoutStore((s) => s.closePanel);
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

  useEffect(() => {
    if (hasHydrated && isExtraEditor && !hasTabs) closePanel(panelId);
  }, [hasHydrated, isExtraEditor, hasTabs, closePanel, panelId]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col"
      onFocus={syncGlobalActive}
      onClick={syncGlobalActive}
      tabIndex={-1}
    >
      <TabBar
        panelId={panelId}
        onClosePanel={isExtraEditor ? () => closePanel(panelId) : undefined}
      />
      <EditorBreadcrumb panelId={panelId} />
      <div className="min-h-0 flex-1">
        <Editor panelId={panelId} />
      </div>
    </div>
  );
}
