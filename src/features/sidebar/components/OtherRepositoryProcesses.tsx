import { Circle, Stop, Terminal } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import type { RunProcess } from "@/shared/stores/runConfig";

interface OtherRepositoryProcessesProps {
  processes: RunProcess[];
  onStop: (processId: string) => void;
  onOpenLogs: (process: RunProcess) => void;
}

/// Processes that keep running in repositories other than the active one.
export function OtherRepositoryProcesses({
  processes,
  onStop,
  onOpenLogs,
}: OtherRepositoryProcessesProps) {
  if (processes.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-ui-xs font-semibold uppercase tracking-wider text-fg-muted">
          Other repositories
        </span>
        <span className="text-ui-xs text-fg-muted">{processes.length}</span>
      </div>
      <div className="space-y-0.5">
        {processes.map((process) => (
          <div
            key={process.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover"
          >
            <Circle size={6} weight="fill" className="shrink-0 text-status-success" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-ui-sm font-medium text-fg-default">
                {process.configName}
              </span>
              <span className="truncate text-ui-xs text-fg-muted" title={process.rootPath}>
                {getWorkspaceName(process.rootPath)}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Stop"
              aria-label={`Stop ${process.configName}`}
              onClick={() => onStop(process.id)}
            >
              <Stop size={12} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Logs"
              aria-label={`Logs of ${process.configName}`}
              onClick={() => onOpenLogs(process)}
            >
              <Terminal size={12} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
