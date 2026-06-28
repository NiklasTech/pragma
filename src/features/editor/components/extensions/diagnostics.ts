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
      const lineNumber = Math.max(1, Math.min(diagnostic.line, view.state.doc.lines));
      const line = view.state.doc.line(lineNumber);
      const column = Math.max(1, Math.min(diagnostic.column, line.length + 1));
      const from = line.from + column - 1;

      return {
        from,
        to: from,
        message: diagnostic.message,
        severity: SEVERITY_MAP[diagnostic.severity],
      };
    });
  });
}
