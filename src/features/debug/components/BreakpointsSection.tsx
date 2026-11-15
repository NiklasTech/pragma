import { invoke } from "@tauri-apps/api/core";
import { PencilSimple, X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { detectLanguage } from "@/shared/lib/language";
import { cn } from "@/shared/lib/utils";
import { useEditorStore } from "@/shared/stores/editor";
import { useDebugStore } from "../store";
import { useBreakpointEditorStore } from "../breakpointEditor";
import { breakpointKind, type BreakpointSettings } from "../breakpointSettings";
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

function describeSettings(settings: BreakpointSettings | undefined): string | null {
  if (!settings) return null;
  if (settings.logMessage) return `Log: ${settings.logMessage}`;
  const parts = [
    settings.condition ? `if ${settings.condition}` : null,
    settings.hitCondition ? `hits ${settings.hitCondition}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function BreakpointsSection({ breakpointCount }: { breakpointCount: number }) {
  const breakpoints = useDebugStore((state) => state.breakpoints);
  const breakpointSettings = useDebugStore((state) => state.breakpointSettings);
  const toggleBreakpoint = useDebugStore((state) => state.toggleBreakpoint);
  const openEditor = useBreakpointEditorStore((state) => state.openEditor);

  return (
    <div className="space-y-1.5">
      <SectionLabel title="Breakpoints" count={breakpointCount} />
      <div className="space-y-0.5">
        {Object.entries(breakpoints).flatMap(([file, lines]) =>
          lines.map((line) => {
            const settings = breakpointSettings[file]?.[line];
            const kind = breakpointKind(settings);
            const detail = describeSettings(settings);
            return (
              <div
                key={`${file}:${line}`}
                className="group flex items-center justify-between gap-2 rounded px-2 py-0.5 hover:bg-bg-hover"
              >
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => void openFileAtLine(file, line)}
                  className="min-w-0 justify-start gap-2 px-0 text-left font-normal text-fg-default hover:bg-transparent"
                  title={file}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 bg-[#e51400]",
                      kind === "logpoint" ? "rotate-45 rounded-[1px]" : "rounded-full",
                    )}
                  />
                  <span className="truncate text-ui-xs text-fg-default">
                    {file.split(/[\\/]/).pop() ?? file}:{line}
                  </span>
                  {detail && <span className="truncate text-ui-xs text-fg-muted">{detail}</span>}
                </Button>
                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Edit breakpoint"
                    onClick={() => openEditor({ file, line })}
                    title="Edit breakpoint"
                    className="size-4 text-fg-muted"
                  >
                    <PencilSimple size={10} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove breakpoint"
                    onClick={() => toggleBreakpoint(file, line)}
                    title="Remove breakpoint"
                    className="size-4 text-fg-muted hover:text-status-error"
                  >
                    <X size={10} />
                  </Button>
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
