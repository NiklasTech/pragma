import { useShallow } from "zustand/react/shallow";
import { useRef, useEffect } from "react";
import { X, Circle, Terminal } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { useRunConfigStore, type RunStatus } from "@/shared/stores/runConfig";

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "running") {
    return (
      <span className="flex items-center gap-1 text-ui-xs text-status-success">
        <Circle size={6} weight="fill" />
        Running
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-ui-xs text-status-error">
        <Circle size={6} weight="fill" />
        Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-ui-xs text-fg-muted">
      <Circle size={6} weight="fill" />
      Stopped
    </span>
  );
}

export function RunOutputPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { processes, activeProcessId, setActiveProcess, removeProcess } = useRunConfigStore(
    useShallow((s) => ({
      processes: s.processes,
      activeProcessId: s.activeProcessId,
      setActiveProcess: s.setActiveProcess,
      removeProcess: s.removeProcess,
    })),
  );

  const activeProcess = processes.find((p) => p.id === activeProcessId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeProcess?.output]);

  if (!activeProcess) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col bg-bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-ui-xs font-medium text-fg-default">{activeProcess.configName}</span>
          <StatusBadge status={activeProcess.status} />
          {activeProcess.exitCode !== null && (
            <span className="text-ui-xs text-fg-muted">exit {activeProcess.exitCode}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {processes.length > 1 && (
            <div className="mr-2 flex items-center gap-1">
              {processes.map((p) => (
                <Button
                  variant="ghost"
                  size="xs"
                  key={p.id}
                  onClick={() => setActiveProcess(p.id)}
                  className={cn(
                    "h-5 gap-1 px-1.5 font-normal",
                    p.id === activeProcessId && "bg-bg-active text-fg-default",
                  )}
                >
                  <Circle
                    size={5}
                    weight="fill"
                    className={
                      p.status === "running"
                        ? "text-status-success"
                        : p.status === "failed"
                          ? "text-status-error"
                          : "text-fg-muted"
                    }
                  />
                  {p.configName}
                </Button>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setActiveProcess(null)}
            className="h-5 gap-1 px-1.5 font-normal"
            title="Back to Terminal"
          >
            <Terminal size={10} />
            <span>Terminal</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            onClick={() => {
              setActiveProcess(null);
              removeProcess(activeProcess.id);
            }}
            className="text-fg-muted"
            title="Close"
          >
            <X size={12} />
          </Button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto p-3 font-mono text-ui-xs select-text"
      >
        {activeProcess.output.length === 0 ? (
          <span className="italic text-fg-muted">No output yet...</span>
        ) : (
          activeProcess.output.map((line, i) => (
            <pre key={i} className="break-all whitespace-pre-wrap leading-relaxed text-fg-default">
              {line}
            </pre>
          ))
        )}
      </div>
    </div>
  );
}
