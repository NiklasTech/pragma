import { useRef } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useLayoutStore } from "@/stores/layout";
import { SidebarContent } from "./Sidebar";
import { MainArea } from "./MainArea";
import { AIChatPanel } from "./AIChatPanel";

export function Layout() {
  const { setSidebarWidth, setAIPanelWidth } = useLayoutStore();

  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const aiRef = useRef<PanelImperativeHandle>(null);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel
          ref={sidebarRef}
          defaultSize={20}
          minSize="48px"
          maxSize={60}
          onResize={(size) => setSidebarWidth(size.asPercentage)}
        >
          <SidebarContent panelRef={sidebarRef} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={55} minSize="120px">
          <MainArea />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          ref={aiRef}
          defaultSize={25}
          minSize="48px"
          maxSize={60}
          onResize={(size) => setAIPanelWidth(size.asPercentage)}
        >
          <AIChatPanel panelRef={aiRef} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
