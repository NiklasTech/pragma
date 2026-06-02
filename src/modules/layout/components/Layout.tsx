import { useRef, useCallback } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useLayoutStore, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from "../store";
import { SidebarDock, SidebarContent } from "./Sidebar";
import { MainArea } from "./MainArea";
import { AIPanel } from "./AIPanel";
import { Titlebar } from "@/components/layout/Titlebar";

export function Layout() {
  const { setSidebarWidth, setSidebarCollapsed, sidebarWidth } = useLayoutStore();

  const sidebarRef = useRef<PanelImperativeHandle>(null);

  const handleSidebarResize = useCallback(
    (size: { inPixels: number; asPercentage: number }) => {
      const collapsed = size.inPixels <= 0;
      setSidebarCollapsed(collapsed);
      if (!collapsed && size.inPixels > 0) {
        setSidebarWidth(size.inPixels);
      }
    },
    [setSidebarCollapsed, setSidebarWidth],
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
      <Titlebar />
      <div className="flex min-h-0 flex-1">
        <SidebarDock panelRef={sidebarRef} />

        <div className="flex min-h-0 flex-1 flex-col">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
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

            <ResizablePanel id="workspace" defaultSize="78%" minSize="30%">
              <MainArea />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <AIPanel />
      </div>
    </div>
  );
}
