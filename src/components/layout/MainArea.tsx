import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useLayoutStore } from "@/stores/layout";
import { FileText, Terminal } from "@phosphor-icons/react";

export function MainArea() {
  const { editorHeight, terminalHeight, setEditorHeight, setTerminalHeight } = useLayoutStore();

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full w-full">
      <ResizablePanel
        defaultSize={editorHeight}
        minSize={10}
        onResize={(size) => setEditorHeight(size.asPercentage)}
      >
        <div className="flex h-full flex-col bg-background">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-sm text-muted-foreground">
            <FileText size={16} />
            <span>Editor</span>
          </div>
          <div className="flex-1 p-4">
            <p className="text-sm text-muted-foreground">Editor content area</p>
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={terminalHeight}
        minSize={10}
        onResize={(size) => setTerminalHeight(size.asPercentage)}
      >
        <div className="flex h-full flex-col bg-card">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-sm text-muted-foreground">
            <Terminal size={16} />
            <span>Terminal</span>
          </div>
          <div className="flex-1 p-4 font-mono text-sm text-muted-foreground">
            Terminal output area
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
