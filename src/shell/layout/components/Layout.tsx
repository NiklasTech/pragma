import { Suspense, lazy, useRef } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { cn } from "@/shared/lib/utils";
import { CARD_CLASS } from "@/shared/lib/surfaces";
import { useLayoutStore } from "../store";
import { SidebarContent } from "@/shell/chrome/Sidebar";
import { LayoutTreeRenderer } from "./LayoutTreeRenderer";
import { AIChatHost } from "./AIChatHost";
import { TerminalFloatingHost } from "./TerminalFloatingHost";
import { FloatingHost } from "@/shell/workspace/FloatingHost";
import { Titlebar } from "@/shell/chrome/Titlebar";
import { Statusbar } from "@/shell/chrome/Statusbar";
import { useUiMode } from "@/shell/mode";
import { DiagnosticsHost } from "@/shared/hooks/useDiagnostics";

const AgentsWorkspace = lazy(() =>
  import("@/features/ai/components/AgentsWorkspace").then((m) => ({ default: m.AgentsWorkspace })),
);

const GAP_HANDLE_CLASS =
  "w-1.5 hover:bg-transparent data-[resize-handle-active]:bg-transparent focus-visible:ring-0 before:absolute before:inset-y-4 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:rounded-full before:transition-colors hover:before:bg-primary/50 data-[resize-handle-active]:before:bg-primary";

export function Layout() {
  const sidebar = useLayoutStore((s) => s.sidebar);
  const ai = useLayoutStore((s) => s.ai);
  const root = useLayoutStore((s) => s.root);
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);
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

  const sidebarPanel = (
    <ResizablePanel
      id="sidebar"
      ref={sidebarRef}
      defaultSize={`${sidebar.width}px`}
      minSize={`${220}px`}
      onResize={handleSidebarResize}
    >
      <div className={cn(CARD_CLASS, "h-full")}>
        <SidebarContent />
      </div>
    </ResizablePanel>
  );

  const workspace = (
    <div className={cn(CARD_CLASS, "h-full min-h-0")}>
      <LayoutTreeRenderer node={root} />
    </div>
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-chrome text-fg-default">
      <DiagnosticsHost />
      <Titlebar />

      {uiMode === "agents" ? (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={null}>
            <AgentsWorkspace />
          </Suspense>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 gap-1.5 overflow-hidden px-1.5">
          {aiVisible && aiDrawerLeft && <AIChatHost />}

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
                  {sidebarPanel}
                  <ResizableHandle className={GAP_HANDLE_CLASS} />
                </>
              )}

              <ResizablePanel id="workspace" minSize="20%">
                {workspace}
              </ResizablePanel>

              {sidebar.position === "right" && (
                <>
                  <ResizableHandle className={GAP_HANDLE_CLASS} />
                  {sidebarPanel}
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">{workspace}</div>
          )}

          {aiVisible && !aiDrawerLeft && <AIChatHost />}
        </div>
      )}

      <Statusbar />
      <TerminalFloatingHost />
      <FloatingHost />
    </div>
  );
}
