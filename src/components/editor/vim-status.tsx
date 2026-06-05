interface VimStatusProps {
  mode: string | null;
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
  if (mode === "insert") return "text-blue-400";
  if (mode === "replace") return "text-orange-400";
  if (mode.startsWith("visual")) return "text-purple-400";
  return "text-green-400";
}

export function VimStatus({ mode, line, column, fileType }: VimStatusProps) {
  if (!mode) return null;

  const label = mode.toUpperCase();
  const colorClass = getModeColor(mode);

  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs border-t border-border bg-muted select-none">
      <span className={`font-medium ${colorClass}`}>{label}</span>
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
