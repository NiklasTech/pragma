import { listen } from "@tauri-apps/api/event";

import { withLspDocument } from "@/features/agent/lspTools";
import { formatProblemList, selectProblems } from "@/shared/lib/problemsReport";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useEditorStore } from "@/shared/stores/editor";
import { useProblemsStore, type Problem, type ProblemSeverity } from "@/shared/stores/problems";

const DIAGNOSTICS_EVENT = "lsp_diagnostics";
const FIRST_REPORT_MS = 15_000;
// Servers may report again shortly after the first answer, e.g. semantic after syntax errors.
const SETTLE_MS = 1_000;
const MAX_PROBLEMS = 200;
const UNNECESSARY_TAG = 1;

export interface LspDiagnostic {
  range: { start: { line: number; character: number } };
  severity?: number;
  source?: string;
  tags?: number[];
  message: string;
}

interface DiagnosticsEvent {
  file_path: string;
  diagnostics: LspDiagnostic[];
}

const SEVERITY: Record<number, ProblemSeverity> = {
  1: "error",
  2: "warning",
  3: "info",
  4: "info",
};

export function toProblems(filePath: string, diagnostics: LspDiagnostic[]): Problem[] {
  return diagnostics.map((diagnostic) => {
    const unnecessary = (diagnostic.tags ?? []).includes(UNNECESSARY_TAG);
    const { line, character } = diagnostic.range.start;
    return {
      id: `${filePath}:${line}:${character}:${diagnostic.message}`,
      severity: unnecessary ? "info" : (SEVERITY[diagnostic.severity ?? 1] ?? "error"),
      message: diagnostic.message,
      filePath,
      line: line + 1,
      column: character + 1,
      source: diagnostic.source ?? "LSP",
    };
  });
}

function report(problems: Problem[]): string {
  const shown = selectProblems(problems, ["error", "warning"]);
  if (shown.length === 0) return "No errors or warnings.";
  const errors = shown.filter((problem) => problem.severity === "error").length;
  const summary = `${errors} errors, ${shown.length - errors} warnings`;
  return `${summary}\n${formatProblemList(shown, MAX_PROBLEMS)}`;
}

function isOpenInEditor(filePath: string): boolean {
  return useEditorStore.getState().tabs.some((tab) => tab.kind === "file" && tab.path === filePath);
}

/// Opens the file with its language server and waits for the server's diagnostics.
export async function collectDiagnostics(filePath: string): Promise<LspDiagnostic[] | null> {
  let count = 0;
  let latest: LspDiagnostic[] | null = null;
  let wake: (() => void) | null = null;
  const unlisten = await listen<DiagnosticsEvent>(DIAGNOSTICS_EVENT, (event) => {
    if (event.payload.file_path !== filePath) return;
    count += 1;
    latest = event.payload.diagnostics;
    wake?.();
  });
  const reportAfter = (seen: number, ms: number) =>
    count > seen
      ? Promise.resolve(true)
      : new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            wake = null;
            resolve(false);
          }, ms);
          wake = () => {
            clearTimeout(timer);
            wake = null;
            resolve(true);
          };
        });
  try {
    await withLspDocument(filePath, async () => {
      if (!(await reportAfter(0, FIRST_REPORT_MS))) return;
      let seen = count;
      while (await reportAfter(seen, SETTLE_MS)) seen = count;
    });
  } finally {
    void unlistenQuietly(unlisten);
  }
  return latest;
}

/// The errors and warnings of one file, or of every file open in the editor.
export async function diagnosticsReport(filePath: string | null): Promise<string> {
  const stored = useProblemsStore.getState().problems;
  if (filePath === null) {
    const text = report(stored);
    return `${text}\nOnly files open in Pragma's editor are checked; pass a path to check another file.`;
  }
  if (isOpenInEditor(filePath)) {
    return report(stored.filter((problem) => problem.filePath === filePath));
  }
  const diagnostics = await collectDiagnostics(filePath);
  if (diagnostics === null) {
    return `The language server sent no diagnostics for ${filePath} within ${FIRST_REPORT_MS / 1000} s.`;
  }
  return report(toProblems(filePath, diagnostics));
}
