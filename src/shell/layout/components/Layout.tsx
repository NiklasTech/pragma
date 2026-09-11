import { useRef } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { useLayoutStore } from "../store";
import { SidebarContent } from "@/shell/chrome/Sidebar";
import { LayoutTreeRenderer } from "./LayoutTreeRenderer";
import { AIChatHost } from "./AIChatHost";
import { TerminalFloatingHost } from "./TerminalFloatingHost";
import { FloatingHost } from "@/shell/workspace/FloatingHost";
import { Titlebar } from "@/shell/chrome/Titlebar";
import { Statusbar } from "@/shell/chrome/Statusbar";
import { AgentsWorkspace } from "@/features/ai/components/AgentsWorkspace";
import { useUiMode } from "@/shell/mode";
import { useDiagnostics } from "@/shared/hooks/useDiagnostics";

export function Layout() {
  useDiagnostics();
  const { sidebar, ai, root, setSidebarWidth } = useLayoutStore();
  const uiMode = useUiMode();

  const sidebarRef = useRef<PanelImperativeHandle | null>(null);
  const sidebarSizeRef = useRef<number>(sidebar.width);

  const handleSidebarResize = (size: PanelSize) => {
    sidebarSizeRef.current = size.inPixels;
  };

  const showSidebar = sidebar.position !== "hidden";
  const sidebarExpanded = showSidebar && !sidebar.collapsed;
  const aiVisible = ai.mode !== "hidden";
  const aiDrawerLeft = ai.mode === "drawer-left";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-root text-fg-default">
      <Titlebar />

      {uiMode === "agents" ? (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <AgentsWorkspace />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {aiVisible && aiDrawerLeft && <AIChatHost />}

          {showSidebar && !sidebarExpanded && sidebar.position === "left" && <SidebarContent />}

          {sidebarExpanded ? (
            <ResizablePanelGroup
              orientation="horizontal"
              className="min-h-0 flex-1 overflow-hidden"
              onLayoutChanged={() => {
                const size = sidebarSizeRef.current;
                if (size > 0) {
                  setSidebarWidth(size);
                }
              }}
            >
              {sidebar.position === "left" && (
                <>
                  <ResizablePanel
                    id="sidebar"
                    ref={sidebarRef}
                    defaultSize={`${sidebar.width}px`}
                    minSize={`${220}px`}
                    onResize={handleSidebarResize}
                  >
                    <SidebarContent />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}

              <ResizablePanel id="workspace" minSize="20%">
                <LayoutTreeRenderer node={root} />
              </ResizablePanel>

              {sidebar.position === "right" && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="sidebar"
                    ref={sidebarRef}
                    defaultSize={`${sidebar.width}px`}
                    minSize={`${220}px`}
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

          {showSidebar && !sidebarExpanded && sidebar.position === "right" && <SidebarContent />}
          {aiVisible && !aiDrawerLeft && <AIChatHost />}
        </div>
      )}

      <Statusbar />
      <TerminalFloatingHost />
      <FloatingHost />
    </div>
  );
}
