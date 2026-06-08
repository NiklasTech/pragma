import { useRef, useCallback } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  useLayoutStore,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  AI_PANEL_MIN_WIDTH,
  AI_PANEL_MAX_WIDTH,
} from "../store";
import { SidebarDock, SidebarContent } from "./Sidebar";
import { MainArea } from "./MainArea";
import { AIPanel } from "./AIPanel";
import { Titlebar } from "@/components/layout/Titlebar";

export function Layout() {
  const {
    setSidebarWidth,
    setSidebarCollapsed,
    sidebarWidth,
    aiPanelOpen,
    aiPanelWidth,
    setAIPanelWidth,
  } = useLayoutStore();

  const sidebarRef = useRef<PanelImperativeHandle>(null);

  const handleSidebarResize = useCallback(
    (size: PanelSize) => {
      const px = size.inPixels;
      const collapsed = px <= 4;
      setSidebarCollapsed(collapsed);
      if (!collapsed && px > 0) {
        setSidebarWidth(px);
      }
    },
    [setSidebarCollapsed, setSidebarWidth],
  );

  const handleAIPanelResize = useCallback(
    (size: PanelSize) => {
      const px = size.inPixels;
      if (px > 0) {
        setAIPanelWidth(px);
      }
    },
    [setAIPanelWidth],
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      <Titlebar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarDock panelRef={sidebarRef} />

        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel
            id="sidebar"
            ref={sidebarRef}
            defaultSize={`${sidebarWidth}px`}
            minSize={`${SIDEBAR_MIN_WIDTH}px`}
            maxSize={`${SIDEBAR_MAX_WIDTH}px`}
            collapsible
            collapsedSize={0}
            onResize={handleSidebarResize}
          >
            <SidebarContent />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="workspace" defaultSize="flex" minSize="20%">
            <MainArea />
          </ResizablePanel>

          {aiPanelOpen && (
            <>
              <ResizableHandle withHandle />

              <ResizablePanel
                id="ai-panel"
                defaultSize={`${aiPanelWidth}px`}
                minSize={`${AI_PANEL_MIN_WIDTH}px`}
                maxSize={`${AI_PANEL_MAX_WIDTH}px`}
                onResize={handleAIPanelResize}
              >
                <AIPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
