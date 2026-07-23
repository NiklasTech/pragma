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
  const errorCount = useProblemsStore((state) => {
    const problems = filePath
      ? state.problems.filter((p) => p.filePath === filePath)
      : state.problems;
    return problems.filter((p) => p.severity === "error").length;
  });

  const warningCount = useProblemsStore((state) => {
    const problems = filePath
      ? state.problems.filter((p) => p.filePath === filePath)
      : state.problems;
    return problems.filter((p) => p.severity === "warning").length;
  });

  return (
    <div className="flex h-statusbar shrink-0 items-center justify-between bg-bg-root px-1 text-ui-xs select-none">
      <div className="flex items-center">
        {vimMode && (
          <div className="flex items-center gap-1.5 px-2">
            <span
              className={cn(
                "rounded-sm bg-accent-subtle px-1.5 py-px text-ui-2xs font-semibold",
                getModeColor(vimMode),
              )}
            >
              {vimMode.toUpperCase()}
            </span>
          </div>
        )}
        {(errorCount > 0 || warningCount > 0) && (
          <div className="flex items-center gap-1.5 px-2">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-status-error">
                <WarningCircle size={14} />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-status-warning">
                <Warning size={14} />
                {warningCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center text-fg-muted">
        <span className="px-2">{getFileTypeLabel(fileType)}</span>
        <span className="px-2">UTF-8</span>
        <span className="px-2">
          Ln {line}, Col {column}
        </span>
      </div>
    </div>
  );
}
