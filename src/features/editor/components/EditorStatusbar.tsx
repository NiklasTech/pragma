import { useSettingsStore } from "@/shared/stores/settings";
import { PushPin } from "@phosphor-icons/react";

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
  if (mode === "replace") return "text-orange-400";
  if (mode.startsWith("visual")) return "text-purple-400";
  return "text-status-success";
}

export function EditorStatusbar({ vimMode, line, column, fileType }: EditorStatusbarProps) {
  const stickyLines = useSettingsStore((state) => state.editor.stickyLines);
  const setEditorSettings = useSettingsStore((state) => state.setEditorSettings);

  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs border-t border-border bg-muted select-none">
      <div className="flex items-center gap-3">
        {vimMode && (
          <span className={`font-medium ${getModeColor(vimMode)}`}>{vimMode.toUpperCase()}</span>
        )}
        <button
          type="button"
          onClick={() => setEditorSettings({ stickyLines: !stickyLines })}
          className={`flex items-center gap-1 transition-colors hover:text-foreground ${stickyLines ? "text-foreground" : "text-muted-foreground"}`}
          title={stickyLines ? "Sticky Lines: On" : "Sticky Lines: Off"}
        >
          <PushPin size={12} weight={stickyLines ? "fill" : "regular"} />
          <span>Sticky</span>
        </button>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>{getFileTypeLabel(fileType)}</span>
        <span>UTF-8</span>
        <span>
          Ln {line}, Col {column}
        </span>
      </div>
    </div>
  );
}
