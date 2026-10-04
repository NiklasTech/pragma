import { invoke } from "@tauri-apps/api/core";
import { X } from "@phosphor-icons/react";
import { detectLanguage } from "@/shared/lib/language";
import { useEditorStore } from "@/shared/stores/editor";
import { useDebugStore } from "../store";
import { SectionLabel } from "./DebugPanelParts";

async function openFileAtLine(file: string, line: number) {
  try {
    const result = await invoke<{ path: string; name: string; content: string }>("read_text_file", {
      path: file,
    });
    const editor = useEditorStore.getState();
    editor.openFile({
      id: result.path,
      path: result.path,
      name: result.name,
      content: result.content,
      originalContent: result.content,
      isModified: false,
      language: detectLanguage(result.name),
    });
    editor.goToPosition(result.path, { line, column: 1 });
  } catch {
    // ignore
  }
}

export function BreakpointsSection({ breakpointCount }: { breakpointCount: number }) {
  const breakpoints = useDebugStore((state) => state.breakpoints);
  const toggleBreakpoint = useDebugStore((state) => state.toggleBreakpoint);

  return (
    <div className="space-y-1.5">
      <SectionLabel title="Breakpoints" count={breakpointCount} />
      <div className="space-y-0.5">
        {Object.entries(breakpoints).flatMap(([file, lines]) =>
          lines.map((line) => (
            <div
              key={`${file}:${line}`}
              className="group flex items-center justify-between gap-2 rounded px-2 py-0.5 hover:bg-bg-hover"
            >
              <button
                type="button"
                onClick={() => void openFileAtLine(file, line)}
                className="flex min-w-0 items-center gap-2 text-left"
                title={file}
              >
                <span className="size-2 shrink-0 rounded-full bg-[#e51400]" />
                <span className="truncate text-ui-xs text-fg-default">
                  {file.split(/[\\/]/).pop() ?? file}:{line}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleBreakpoint(file, line)}
                title="Remove breakpoint"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
