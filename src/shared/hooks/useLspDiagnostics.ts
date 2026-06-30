import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProblemsStore, type ProblemSeverity } from "@/shared/stores/problems";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";

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
  tags?: number[];
  message: string;
}

const UNNECESSARY_TAG = 1;
const DEPRECATED_TAG = 2;

function hasUnnecessaryTag(diagnostic: LspDiagnostic): boolean {
  return (diagnostic.tags ?? []).includes(UNNECESSARY_TAG);
}

function hasDeprecatedTag(diagnostic: LspDiagnostic): boolean {
  return (diagnostic.tags ?? []).includes(DEPRECATED_TAG);
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
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);
  const tabs = useEditorStore((state) => state.tabs);
  const openPaths = useMemo(
    () => new Set(tabs.filter((t) => t.kind === "file").map((t) => t.path)),
    [tabs],
  );
  const setFileDiagnostics = useProblemsStore((state) => state.setFileDiagnostics);

  useEffect(() => {
    if (!experimentalLsp) {
      return;
    }

    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<LspDiagnosticsEvent>("lsp_diagnostics", (event) => {
        const { file_path, diagnostics } = event.payload;
        if (!openPaths.has(file_path)) {
          return;
        }

        const hasRealError = diagnostics.some(
          (d) => (d.severity ?? 1) === 1 && !hasUnnecessaryTag(d),
        );

        const problems = diagnostics
          .filter((diagnostic) => {
            if (hasDeprecatedTag(diagnostic)) {
              return false;
            }
            if (hasUnnecessaryTag(diagnostic) && hasRealError) {
              return false;
            }
            return true;
          })
          .map((diagnostic) => {
            const baseSeverity = SEVERITY_MAP[diagnostic.severity ?? 1] ?? "error";
            const severity: ProblemSeverity = hasUnnecessaryTag(diagnostic) ? "info" : baseSeverity;

            return {
              id: `${file_path}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`,
              severity,
              message: diagnostic.message,
              filePath: file_path,
              line: diagnostic.range.start.line + 1,
              column: diagnostic.range.start.character + 1,
              endLine: diagnostic.range.end.line + 1,
              endColumn: diagnostic.range.end.character + 1,
              source: diagnostic.source ?? "LSP",
            };
          });
        setFileDiagnostics(file_path, problems);
      });
    };

    void setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [openPaths, setFileDiagnostics, experimentalLsp]);
}
