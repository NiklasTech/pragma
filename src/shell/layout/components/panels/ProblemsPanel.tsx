import { useShallow } from "zustand/react/shallow";
import { useMemo, useState } from "react";
import {
  CaretDown,
  CaretRight,
  FileText,
  Info,
  ArrowsClockwise,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useProblemsStore, type ProblemSeverity } from "@/shared/stores/problems";
import { useEditorStore } from "@/shared/stores/editor";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { countBySeverity, groupProblemsByFile } from "./problemGroups";

const severityConfig: Record<
  ProblemSeverity,
  { icon: typeof Warning; label: string; color: string }
> = {
  error: { icon: WarningCircle, label: "Error", color: "text-status-error" },
  warning: { icon: Warning, label: "Warning", color: "text-status-warning" },
  info: { icon: Info, label: "Info", color: "text-status-info" },
};

type SeverityFilter = "all" | ProblemSeverity;

const severityFilters: { id: SeverityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
  { id: "info", label: "Info" },
];

export default function ProblemsPanel() {
  const { problems, isLoading, refreshProblems } = useProblemsStore(
    useShallow((s) => ({
      problems: s.problems,
      isLoading: s.isLoading,
      refreshProblems: s.refreshProblems,
    })),
  );
  const { tabs, openFile, setActiveTab, setPanelActiveTab, goToPosition } = useEditorStore(
    useShallow((s) => ({
      tabs: s.tabs,
      openFile: s.openFile,
      setActiveTab: s.setActiveTab,
      setPanelActiveTab: s.setPanelActiveTab,
      goToPosition: s.goToPosition,
    })),
  );
  const editorPanelId = useEditorPanelId();
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [collapsedFiles, setCollapsedFiles] = useState<string[]>([]);

  const counts = useMemo(() => countBySeverity(problems), [problems]);
  const filterCounts: Record<SeverityFilter, number> = {
    all: problems.length,
    error: counts.error,
    warning: counts.warning,
    info: counts.info,
  };
  const visibleProblems = useMemo(
    () => (filter === "all" ? problems : problems.filter((p) => p.severity === filter)),
    [problems, filter],
  );
  const groups = useMemo(() => groupProblemsByFile(visibleProblems), [visibleProblems]);

  const toggleFile = (filePath: string) => {
    setCollapsedFiles((current) =>
      current.includes(filePath)
        ? current.filter((entry) => entry !== filePath)
        : [...current, filePath],
    );
  };

  const handleClick = (filePath: string, line: number, column: number) => {
    const existing = tabs.find((t) => t.path === filePath);
    const targetTabId = existing?.id ?? filePath;

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
          originalContent: "",
          isModified: false,
        },
        editorPanelId,
      );
    }

    goToPosition(targetTabId, { line, column });
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 items-center justify-between px-3">
        <span className="text-ui-xs font-medium text-fg-default">
          Problems
          {visibleProblems.length > 0 && (
            <span className="ml-2 rounded-full bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-muted">
              {visibleProblems.length}
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void refreshProblems()}
          disabled={isLoading}
          className="gap-1 px-2"
        >
          <ArrowsClockwise size={14} className={cn(isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle px-3 py-1">
        {severityFilters.map((entry) => (
          <Button
            variant="ghost"
            size="xs"
            key={entry.id}
            onClick={() => setFilter(entry.id)}
            aria-pressed={filter === entry.id}
            className={cn(
              "px-2 font-normal",
              filter === entry.id && "bg-bg-active text-fg-default",
            )}
          >
            {entry.label}
            <span className="ml-1 text-ui-2xs text-fg-subtle">{filterCounts[entry.id]}</span>
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {problems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
            <Info size={28} className="text-fg-subtle" />
            <span>No problems detected.</span>
          </div>
        ) : visibleProblems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
            <Info size={28} className="text-fg-subtle" />
            <span>No problems match this filter.</span>
          </div>
        ) : (
          <ul>
            {groups.map((group) => {
              const isCollapsed = collapsedFiles.includes(group.filePath);
              return (
                <li key={group.filePath} className="border-b border-border-subtle last:border-b-0">
                  <Button
                    variant="ghost"
                    onClick={() => toggleFile(group.filePath)}
                    aria-expanded={!isCollapsed}
                    className="w-full justify-start gap-2 rounded-none px-3 py-1.5 text-left text-fg-default h-auto whitespace-normal font-normal"
                  >
                    {isCollapsed ? (
                      <CaretRight size={12} className="shrink-0 text-fg-subtle" />
                    ) : (
                      <CaretDown size={12} className="shrink-0 text-fg-subtle" />
                    )}
                    <FileText size={14} className="shrink-0 text-fg-subtle" />
                    <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-default">
                      {group.filePath}
                    </span>
                    <span className="shrink-0 text-ui-2xs text-fg-subtle">
                      {group.problems.length}
                    </span>
                  </Button>
                  {!isCollapsed && (
                    <ul className="divide-y divide-border-subtle">
                      {group.problems.map((problem) => {
                        const config = severityConfig[problem.severity];
                        const Icon = config.icon;
                        return (
                          <li key={problem.id}>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                handleClick(problem.filePath, problem.line, problem.column)
                              }
                              className="w-full items-start justify-start gap-3 rounded-none py-2 pr-3 pl-8 text-left text-fg-default h-auto whitespace-normal font-normal"
                            >
                              <Icon size={16} className={cn("mt-0.5 shrink-0", config.color)} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-ui-sm text-fg-default select-text">
                                  {problem.message}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 text-ui-xs text-fg-muted">
                                  <span className="truncate">
                                    {problem.line}:{problem.column}
                                  </span>
                                  <span className="rounded bg-bg-hover px-1 text-ui-2xs text-fg-subtle">
                                    {problem.source}
                                  </span>
                                </p>
                              </div>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
