import { useRef, useCallback } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { useLayoutStore } from "../store";
import { SidebarDock, SidebarContent } from "@/shell/chrome/Sidebar";
import { LayoutTreeRenderer } from "./LayoutTreeRenderer";
import { AIChatHost } from "./AIChatHost";
import { TerminalFloatingHost } from "./TerminalFloatingHost";
import { FloatingHost } from "@/shell/workspace/FloatingHost";
import { Titlebar } from "@/shell/chrome/Titlebar";
import { useDiagnostics } from "@/shared/hooks/useDiagnostics";

export function Layout() {
  useDiagnostics();
  const { sidebar, ai, root, setSidebarWidth } = useLayoutStore();

  const sidebarRef = useRef<PanelImperativeHandle | null>(null);

  const handleSidebarResize = useCallback(
    (size: PanelSize) => {
      const px = size.inPixels;
      if (px > 0) {
        setSidebarWidth(px);
      }
    },
    [setSidebarWidth],
  );

  const showSidebar = sidebar.position !== "hidden";
  const aiDrawerLeft = ai.mode === "drawer-left";
  const aiDrawerRight = ai.mode === "drawer-right";
  const sidebarExpanded = showSidebar && !sidebar.collapsed;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Titlebar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {aiDrawerLeft && <AIChatHost />}

        {showSidebar && sidebar.position === "left" && <SidebarDock />}

        {sidebarExpanded ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 overflow-hidden">
            {sidebar.position === "left" && (
              <>
                <ResizablePanel
                  id="sidebar"
                  ref={sidebarRef}
                  defaultSize={`${sidebar.width}px`}
                  minSize={`${180}px`}
                  maxSize={`${480}px`}
                  onResize={handleSidebarResize}
                >
                  <SidebarContent />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            <ResizablePanel id="workspace" defaultSize="flex" minSize="20%">
              <LayoutTreeRenderer node={root} />
            </ResizablePanel>

            {sidebar.position === "right" && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="sidebar"
                  ref={sidebarRef}
                  defaultSize={`${sidebar.width}px`}
                  minSize={`${180}px`}
                  maxSize={`${480}px`}
                  onResize={handleSidebarResize}
                >
                  <SidebarContent />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <LayoutTreeRenderer node={root} />
          </div>
        )}

        {showSidebar && sidebar.position === "right" && <SidebarDock />}
        {aiDrawerRight && <AIChatHost />}
      </div>

      {ai.mode === "bottom-sheet" && <AIChatHost />}
      {ai.mode === "floating" && <AIChatHost />}
      <TerminalFloatingHost />
      <FloatingHost />
    </div>
  );
}
