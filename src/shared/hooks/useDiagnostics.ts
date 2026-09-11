import { useEffect } from "react";
import { useEditorStore, type EditorTab } from "@/shared/stores/editor";
import { useProblemsStore, type Problem } from "@/shared/stores/problems";

const LONG_LINE_THRESHOLD = 120;

function buildId(filePath: string, line: number, code: string): string {
  return `${filePath}:${line}:${code}`;
}

function collectPragmaDiagnostics(tabs: EditorTab[]): Problem[] {
  const problems: Problem[] = [];

  for (const tab of tabs) {
    if (tab.kind !== "file") continue;
    const lines = tab.content.split("\n");
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();

      if (trimmed.includes("TODO")) {
        problems.push({
          id: buildId(tab.path, lineNumber, "todo"),
          severity: "info",
          message: `TODO: ${trimmed}`,
          filePath: tab.path,
          line: lineNumber,
          column: line.indexOf("TODO") + 1,
          source: "pragma",
        });
      }

      if (trimmed.includes("FIXME")) {
        problems.push({
          id: buildId(tab.path, lineNumber, "fixme"),
          severity: "warning",
          message: `FIXME: ${trimmed}`,
          filePath: tab.path,
          line: lineNumber,
          column: line.indexOf("FIXME") + 1,
          source: "pragma",
        });
      }

      if (line.length > LONG_LINE_THRESHOLD) {
        problems.push({
          id: buildId(tab.path, lineNumber, "long-line"),
          severity: "warning",
          message: `Line exceeds ${LONG_LINE_THRESHOLD} characters`,
          filePath: tab.path,
          line: lineNumber,
          column: LONG_LINE_THRESHOLD,
          source: "pragma",
        });
      }
    });
  }

  return problems;
}

export function useDiagnostics() {
  const tabs = useEditorStore((s) => s.tabs);
  const setPragmaDiagnostics = useProblemsStore((s) => s.setPragmaDiagnostics);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPragmaDiagnostics(collectPragmaDiagnostics(tabs));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [tabs, setPragmaDiagnostics]);
}

export function DiagnosticsHost() {
  useDiagnostics();
  return null;
}
