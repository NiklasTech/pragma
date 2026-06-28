import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProblemsStore, type ProblemSeverity } from "@/shared/stores/problems";

interface LspPosition {
  line: number;
  character: number;
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

interface LspDiagnostic {
  range: LspRange;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

interface LspDiagnosticsEvent {
  language: string;
  file_path: string;
  diagnostics: LspDiagnostic[];
}

const SEVERITY_MAP: Record<number, ProblemSeverity> = {
  1: "error",
  2: "warning",
  3: "info",
  4: "info",
};

export function useLspDiagnostics() {
  const setFileDiagnostics = useProblemsStore((state) => state.setFileDiagnostics);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<LspDiagnosticsEvent>("lsp_diagnostics", (event) => {
        const { file_path, diagnostics } = event.payload;
        const problems = diagnostics.map((diagnostic) => ({
          id: `${file_path}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`,
          severity: SEVERITY_MAP[diagnostic.severity ?? 1] ?? "error",
          message: diagnostic.message,
          filePath: file_path,
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character + 1,
          endLine: diagnostic.range.end.line + 1,
          endColumn: diagnostic.range.end.character + 1,
          source: diagnostic.source ?? "LSP",
        }));
        setFileDiagnostics(file_path, problems);
      });
    };

    void setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [setFileDiagnostics]);
}
