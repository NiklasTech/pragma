import { linter, type Diagnostic as CodeMirrorDiagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { Problem, ProblemSeverity } from "@/shared/stores/problems";

const SEVERITY_MAP: Record<ProblemSeverity, "error" | "warning" | "info"> = {
  error: "error",
  warning: "warning",
  info: "info",
};

export function createLinter(diagnostics: Problem[]) {
  return linter((view: EditorView) => {
    return diagnostics.map((diagnostic): CodeMirrorDiagnostic => {
      const clampLine = (line: number) => Math.max(1, Math.min(line, view.state.doc.lines));
      const startLineNumber = clampLine(diagnostic.line);
      const startLine = view.state.doc.line(startLineNumber);
      const startColumn = Math.max(1, Math.min(diagnostic.column, startLine.length + 1));
      const from = startLine.from + startColumn - 1;

      const endLineNumber = Math.max(
        startLineNumber,
        clampLine(diagnostic.endLine ?? diagnostic.line),
      );
      const endLine = view.state.doc.line(endLineNumber);
      const endColumn = diagnostic.endColumn
        ? Math.max(1, Math.min(diagnostic.endColumn, endLine.length + 1))
        : Math.min(startColumn + 1, endLine.length + 1);
      let to =
        endLineNumber === startLineNumber
          ? Math.max(from, endLine.from + endColumn - 1)
          : endLine.from + endColumn - 1;

      if (to <= from) {
        to = Math.min(from + 1, startLine.to);
      }

      return {
        from,
        to,
        message: diagnostic.message,
        severity: SEVERITY_MAP[diagnostic.severity],
      };
    });
  });
}
