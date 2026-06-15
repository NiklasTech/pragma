import { useSettingsStore } from "@/shared/stores/settings";
import { PushPin } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

interface EditorStatusbarProps {
  vimMode: string | null;
  line: number;
  column: number;
  fileType: string;
}

function getFileTypeLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "JavaScript React",
    rs: "Rust",
    py: "Python",
    go: "Go",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    json: "JSON",
    md: "Markdown",
    yaml: "YAML",
    yml: "YAML",
    sql: "SQL",
    java: "Java",
    cpp: "C++",
    c: "C",
    h: "C Header",
    php: "PHP",
    vue: "Vue",
    xml: "XML",
  };
  return map[ext ?? ""] ?? (ext ? ext.toUpperCase() : "Plain Text");
}

function getModeColor(mode: string): string {
  if (mode === "insert") return "text-status-info";
  if (mode === "replace") return "text-status-warning";
  if (mode.startsWith("visual")) return "text-[#c084fc]";
  return "text-status-success";
}

export function EditorStatusbar({ vimMode, line, column, fileType }: EditorStatusbarProps) {
  const stickyLines = useSettingsStore((state) => state.editor.stickyLines);
  const setEditorSettings = useSettingsStore((state) => state.setEditorSettings);

  return (
    <div className="flex h-statusbar items-center justify-between border-t border-border/60 bg-bg-surface px-3 text-ui-xs select-none">
      <div className="flex items-center gap-3">
        {vimMode && (
          <span className={cn("font-semibold", getModeColor(vimMode))}>
            {vimMode.toUpperCase()}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditorSettings({ stickyLines: !stickyLines })}
          className={cn(
            "flex items-center gap-1 transition-colors hover:text-fg-default",
            stickyLines ? "text-fg-default" : "text-fg-muted",
          )}
          title={stickyLines ? "Sticky Lines: On" : "Sticky Lines: Off"}
        >
          <PushPin size={12} weight={stickyLines ? "fill" : "regular"} />
          <span>Sticky</span>
        </button>
      </div>
      <div className="flex items-center gap-4 text-fg-muted">
        <span>{getFileTypeLabel(fileType)}</span>
        <span>UTF-8</span>
        <span>
          Ln {line}, Col {column}
        </span>
      </div>
    </div>
  );
}
