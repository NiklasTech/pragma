import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useLayoutStore } from "../store";
import { useEditorStore } from "@/stores/editor";
import { Editor } from "@/components/editor";
import { FileText, Terminal, X } from "@phosphor-icons/react";

export function MainArea() {
  const { editorHeight, terminalHeight, setEditorHeight, setTerminalHeight } = useLayoutStore();
  const { openFiles, activeTabId, setActiveTab, closeFile } = useEditorStore();

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
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground shrink-0">
              <FileText size={16} />
              <span>Editor</span>
            </div>
            <div className="flex min-w-0 flex-1 overflow-x-auto">
              {openFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setActiveTab(file.id)}
                  className={
                    "group flex items-center gap-2 px-3 py-2 text-xs border-r border-border shrink-0 cursor-pointer " +
                    (activeTabId === file.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50")
                  }
                >
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  {file.isModified && <span className="text-muted-foreground">*</span>}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-foreground cursor-pointer"
                  >
                    <X size={12} />
                  </span>
                </button>
              ))}
            </div>
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
            <Terminal size={16} />
            <span>Terminal</span>
          </div>
          <div className="flex-1 min-h-0 p-4 font-mono text-sm text-muted-foreground">
            Terminal output area
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
