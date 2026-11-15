import { ArrowDown, ArrowUp, GitBranch, Warning, XCircle } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { EncodingMenu } from "@/features/editor/encoding/EncodingMenu";
import { encodingLabel } from "@/features/editor/encoding/encodings";
import { useEditorStore } from "@/shared/stores/editor";
import { useGitStore } from "@/shared/stores/git";
import { useProblemsStore } from "@/shared/stores/problems";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout/store";

function detectEol(content: string): string {
  return content.includes("\r\n") ? "CRLF" : "LF";
}

interface EditorStatusChipProps {
  panelId: string;
}

/// The open file on the bottom line: problems, cursor, language, unusual encoding or line ends, branch.
export function EditorStatusChip({ panelId }: EditorStatusChipProps) {
  const vimEnabled = useSettingsStore((s) => s.editor.vimMode);
  const activeTabId = useEditorStore((s) => s.getPanelActiveTabId(panelId));
  const activeTab = useEditorStore((s) => s.tabs.find((tab) => tab.id === activeTabId));
  const cursor = useEditorStore((s) => (activeTabId ? s.cursorPositions[activeTabId] : null));
  const vimMode = useEditorStore((s) => (activeTabId ? (s.vimModes[activeTabId] ?? null) : null));
  const branch = useGitStore((s) => s.snapshot?.repo.branch ?? null);
  const ahead = useGitStore((s) => s.snapshot?.ahead ?? 0);
  const behind = useGitStore((s) => s.snapshot?.behind ?? 0);
  const problems = useProblemsStore((s) => s.problems);

  if (activeTab?.kind !== "file") return null;

  const ext = activeTab.name.split(".").pop()?.toLowerCase() ?? "";
  const errors = problems.filter((problem) => problem.severity === "error").length;
  const warnings = problems.filter((problem) => problem.severity === "warning").length;

  const parts: Array<{ key: string; node: React.ReactNode }> = [];
  if (branch) {
    parts.push({
      key: "branch",
      node: (
        <span className="flex items-center gap-1" title={`Branch ${branch}`}>
          <GitBranch size={11} aria-hidden="true" />
          {branch}
          {ahead > 0 && (
            <span className="flex items-center" aria-label={`${ahead} to push`}>
              <ArrowUp size={10} weight="bold" aria-hidden="true" />
              {ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="flex items-center" aria-label={`${behind} to pull`}>
              <ArrowDown size={10} weight="bold" aria-hidden="true" />
              {behind}
            </span>
          )}
        </span>
      ),
    });
  }
  if (errors > 0 || warnings > 0) {
    parts.push({
      key: "problems",
      node: (
        <Button
          variant="ghost"
          onClick={() => useLayoutStore.getState().addFloatingPanel("problems")}
          aria-label={`${errors} errors and ${warnings} warnings, open problems`}
          className="h-auto gap-1 rounded-[4px] p-0 text-[length:inherit] font-normal text-inherit hover:bg-transparent hover:text-fg-default px-0.5"
        >
          {errors > 0 && <XCircle size={11} className="text-status-error" aria-hidden="true" />}
          {errors > 0 && errors}
          {warnings > 0 && <Warning size={11} className="text-status-warning" aria-hidden="true" />}
          {warnings > 0 && warnings}
        </Button>
      ),
    });
  }
  parts.push(
    { key: "cursor", node: `Ln ${cursor?.line ?? 1}, Col ${cursor?.column ?? 1}` },
    { key: "type", node: ext ? ext.toUpperCase() : "TXT" },
  );
  // UTF-8 with LF is the norm; only an exception earns a place on the line.
  if (encodingLabel(activeTab.encoding) !== "UTF-8") {
    parts.push({ key: "encoding", node: <EncodingMenu tab={activeTab} /> });
  }
  if (detectEol(activeTab.content) === "CRLF") parts.push({ key: "eol", node: "CRLF" });
  // The branch closes the line, as on the board.
  const branchPart = parts.find((part) => part.key === "branch");
  const ordered = branchPart ? [...parts.filter((part) => part !== branchPart), branchPart] : parts;

  return (
    <div className="ml-auto flex shrink-0 items-center gap-3.5 pr-1.5 pl-3 text-ui-xs whitespace-nowrap text-fg-muted tabular-nums">
      {vimEnabled && (
        <span className="rounded-full bg-bg-active px-1.5 font-semibold text-fg-default">
          {vimMode ? vimMode.toUpperCase() : "VIM"}
        </span>
      )}
      {ordered.map((part) => (
        <span key={part.key} className="flex items-center">
          {part.node}
        </span>
      ))}
    </div>
  );
}
