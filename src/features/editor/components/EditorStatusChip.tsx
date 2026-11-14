import { ArrowDown, ArrowUp, GitBranch, Warning, XCircle } from "@phosphor-icons/react";

import { EncodingMenu } from "@/features/editor/encoding/EncodingMenu";
import { useEditorStore } from "@/shared/stores/editor";
import { useGitStore } from "@/shared/stores/git";
import { useProblemsStore } from "@/shared/stores/problems";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout/store";

function detectEol(content: string): string {
  return content.includes("\r\n") ? "CRLF" : "LF";
}

function Dot() {
  return <span aria-hidden="true" className="size-0.5 rounded-full bg-fg-subtle" />;
}

interface EditorStatusChipProps {
  panelId: string;
}

/// The editor line: branch, problems and the open file's details at the end of the breadcrumb row.
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
        <button
          type="button"
          onClick={() => useLayoutStore.getState().addFloatingPanel("problems")}
          aria-label={`${errors} errors and ${warnings} warnings, open problems`}
          className="flex items-center gap-1 rounded-[4px] px-0.5 transition-colors hover:text-fg-default"
        >
          {errors > 0 && <XCircle size={11} className="text-status-error" aria-hidden="true" />}
          {errors > 0 && errors}
          {warnings > 0 && <Warning size={11} className="text-status-warning" aria-hidden="true" />}
          {warnings > 0 && warnings}
        </button>
      ),
    });
  }
  parts.push(
    { key: "cursor", node: `Ln ${cursor?.line ?? 1}, Col ${cursor?.column ?? 1}` },
    { key: "type", node: ext ? ext.toUpperCase() : "TXT" },
    { key: "encoding", node: <EncodingMenu tab={activeTab} /> },
    { key: "eol", node: detectEol(activeTab.content) },
  );

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 pl-3 text-ui-2xs whitespace-nowrap text-fg-subtle tabular-nums">
      {vimEnabled && (
        <span className="rounded-full bg-bg-active px-1.5 font-semibold text-fg-default">
          {vimMode ? vimMode.toUpperCase() : "VIM"}
        </span>
      )}
      {parts.map((part, index) => (
        <span key={part.key} className="flex items-center gap-2">
          {index > 0 && <Dot />}
          {part.node}
        </span>
      ))}
    </div>
  );
}
