import { Suspense, lazy, useRef, useState } from "react";
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
import { SidebarDrawer } from "@/shell/chrome/SidebarDrawer";
import { EditorBottomLine } from "@/features/editor/components/EditorBottomLine";
import { LayoutTreeRenderer } from "./LayoutTreeRenderer";
import { AIChatHost } from "./AIChatHost";
import { TerminalFloatingHost } from "./TerminalFloatingHost";
import { FloatingHost } from "@/shell/workspace/FloatingHost";
import { Strip } from "@/shell/chrome/Strip";
import { AgentRail } from "@/shell/chrome/AgentRail";
import { AgentSheet } from "@/shell/chrome/AgentSheet";
import { CommandLine } from "@/shell/chrome/commandLine/CommandLine";
import { useUiMode } from "@/shell/mode";
import { KeptAgentsTab } from "@/features/ai/panes/store";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTabIdFor } from "@/shared/stores/spaces/model";
import { useTabModeSync } from "@/shell/mode/tabModeSync";
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
  const [shown, setShown] = useState({ agents: false, editor: false });
  if (!shown[uiMode]) setShown({ ...shown, [uiMode]: true });
  // Behind the code tab the agents view keeps the tab it showed, so its terminals stay as they are.
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const tabId = useOpenRepositoriesStore((state) => activeTabIdFor(state.spaces, rootPath));
  const [keptTab, setKeptTab] = useState({ rootPath, tabId });
  if (uiMode === "agents" && (keptTab.rootPath !== rootPath || keptTab.tabId !== tabId)) {
    setKeptTab({ rootPath, tabId });
  }
  useTabModeSync();

  const sidebarRef = useRef<PanelImperativeHandle | null>(null);
  const sidebarSizeRef = useRef<number>(sidebar.width);

  const handleSidebarResize = (size: PanelSize) => {
    sidebarSizeRef.current = size.inPixels;
  };

  const showSidebar = sidebar.position !== "hidden";
  const sidebarExpanded = showSidebar && !sidebar.collapsed && sidebar.pinned;
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
    <div className={cn(CARD_CLASS, "flex h-full min-h-0 flex-col")}>
      <div className="min-h-0 flex-1">
        <LayoutTreeRenderer node={root} />
      </div>
      <EditorBottomLine />
    </div>
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-chrome text-fg-default">
      <DiagnosticsHost />
      <Strip />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AgentRail />
        <AgentSheet />
        {/* Both sides stay mounted once shown, so switching keeps editors, terminals and git state. */}
        {shown.agents && (
          <div
            inert={uiMode !== "agents"}
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 overflow-hidden",
              uiMode !== "agents" && "hidden",
            )}
          >
            <KeptAgentsTab.Provider value={uiMode === "agents" ? null : keptTab}>
              <Suspense fallback={null}>
                <AgentsWorkspace />
              </Suspense>
            </KeptAgentsTab.Provider>
          </div>
        )}
        {shown.editor && (
          <div
            inert={uiMode !== "editor"}
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden pr-1.5 pb-1.5",
              uiMode !== "editor" && "hidden",
            )}
          >
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

                <ResizablePanel id="workspace" minSize="320px">
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
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {workspace}
                <SidebarDrawer />
              </div>
            )}

            {aiVisible && !aiDrawerLeft && <AIChatHost />}
          </div>
        )}
      </div>

      <CommandLine />
      <TerminalFloatingHost />
      <FloatingHost />
    </div>
  );
}
