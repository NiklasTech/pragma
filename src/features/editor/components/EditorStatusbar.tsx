import { cn } from "@/shared/lib/utils";
import { useProblemsStore } from "@/shared/stores/problems";
import { WarningCircle, Warning } from "@phosphor-icons/react";

interface EditorStatusbarProps {
  vimMode: string | null;
  line: number;
  column: number;
  fileType: string;
  filePath?: string;
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

export function EditorStatusbar({
  vimMode,
  line,
  column,
  fileType,
  filePath,
}: EditorStatusbarProps) {
  const counts = useProblemsStore((state) => {
    const problems = filePath
      ? state.problems.filter((p) => p.filePath === filePath)
      : state.problems;
    return {
      errors: problems.filter((p) => p.severity === "error").length,
      warnings: problems.filter((p) => p.severity === "warning").length,
    };
  });

  return (
    <div className="flex h-statusbar items-center justify-between border-t border-border/60 bg-bg-surface px-3 text-ui-xs select-none">
      <div className="flex items-center gap-3">
        {vimMode && (
          <span className={cn("font-semibold", getModeColor(vimMode))}>
            {vimMode.toUpperCase()}
          </span>
        )}
        {(counts.errors > 0 || counts.warnings > 0) && (
          <div className="flex items-center gap-2">
            {counts.errors > 0 && (
              <span className="flex items-center gap-1 text-status-error">
                <WarningCircle size={14} />
                {counts.errors}
              </span>
            )}
            {counts.warnings > 0 && (
              <span className="flex items-center gap-1 text-status-warning">
                <Warning size={14} />
                {counts.warnings}
              </span>
            )}
          </div>
        )}
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
