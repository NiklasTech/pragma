import { Warning, WarningCircle, Info, ArrowsClockwise, FileText } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useProblemsStore, type ProblemSeverity } from "@/shared/stores/problems";
import { useEditorStore } from "@/shared/stores/editor";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";

const severityConfig: Record<
  ProblemSeverity,
  { icon: typeof Warning; label: string; color: string }
> = {
  error: { icon: WarningCircle, label: "Error", color: "text-status-error" },
  warning: { icon: Warning, label: "Warning", color: "text-status-warning" },
  info: { icon: Info, label: "Info", color: "text-status-info" },
};

export default function ProblemsPanel() {
  const { problems, isLoading, refreshProblems } = useProblemsStore();
  const { tabs, openFile, setActiveTab, setPanelActiveTab } = useEditorStore();
  const editorPanelId = useEditorPanelId();

  const handleClick = (filePath: string, line: number, column: number) => {
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      if (editorPanelId) {
        setPanelActiveTab(editorPanelId, existing.id);
      } else {
        setActiveTab(existing.id);
      }
    } else {
      openFile(
        {
          id: filePath,
          path: filePath,
          name: filePath.split("/").pop() ?? filePath,
          content: "",
          isModified: false,
        },
        editorPanelId,
      );
    }
    // TODO: move cursor to line/column once editor supports programmatic cursor setting.
    void { line, column };
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 items-center justify-between border-b border-border bg-bg-surface px-3">
        <span className="text-ui-xs font-medium text-fg-default">
          Problems
          {problems.length > 0 && (
            <span className="ml-2 rounded-full bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-muted">
              {problems.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => void refreshProblems()}
          disabled={isLoading}
          className="flex items-center gap-1 rounded px-2 py-1 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={cn(isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {problems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
            <Info size={28} className="text-fg-subtle" />
            <span>No problems detected.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {problems.map((problem) => {
              const config = severityConfig[problem.severity];
              const Icon = config.icon;
              return (
                <li key={problem.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(problem.filePath, problem.line, problem.column)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                  >
                    <Icon size={16} className={cn("mt-0.5 shrink-0", config.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ui-sm text-fg-default">{problem.message}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-ui-xs text-fg-muted">
                        <FileText size={12} />
                        <span className="truncate">
                          {problem.filePath}:{problem.line}:{problem.column}
                        </span>
                        <span className="rounded bg-bg-hover px-1 text-ui-2xs text-fg-subtle">
                          {problem.source}
                        </span>
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
