import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useLayoutStore } from "../store";
import { Editor } from "@/components/editor";
import { TabBar } from "@/components/editor/TabBar";
import { Terminal } from "@/components/terminal";
import { FileText, Terminal as TerminalIcon } from "@phosphor-icons/react";

export function MainArea() {
  const { editorHeight, terminalHeight, setEditorHeight, setTerminalHeight } = useLayoutStore();

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full w-full">
      <ResizablePanel
        defaultSize={editorHeight}
        minSize={10}
        onResize={(size) => setEditorHeight(size.asPercentage)}
      >
        <div className="flex h-full min-h-0 flex-col bg-background">
          {/* Tab Bar */}
          <div className="flex items-center border-b border-border">
            <div className="flex shrink-0 items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <FileText size={16} />
              <span>Editor</span>
            </div>
            <TabBar />
          </div>

          {/* Editor Content */}
          <div className="flex-1 min-h-0">
            <Editor />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        defaultSize={terminalHeight}
        minSize={10}
        onResize={(size) => setTerminalHeight(size.asPercentage)}
      >
        <div className="flex h-full min-h-0 flex-col bg-card">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-sm text-muted-foreground">
            <TerminalIcon size={16} />
            <span>Terminal</span>
          </div>
          <div className="flex-1 min-h-0">
            <Terminal />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
