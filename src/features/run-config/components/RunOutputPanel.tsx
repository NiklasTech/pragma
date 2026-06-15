import { useRef, useEffect } from "react";
import { X, Circle, Terminal } from "@phosphor-icons/react";
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
    <span className="flex items-center gap-1 text-ui-xs text-muted-foreground">
      <Circle size={6} weight="fill" />
      Stopped
    </span>
  );
}

export function RunOutputPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { processes, activeProcessId, setActiveProcess, removeProcess } = useRunConfigStore();

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
    <div className="flex h-full w-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{activeProcess.configName}</span>
          <StatusBadge status={activeProcess.status} />
          {activeProcess.exitCode !== null && (
            <span className="text-ui-xs text-muted-foreground">exit {activeProcess.exitCode}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {processes.length > 1 && (
            <div className="mr-2 flex items-center gap-1">
              {processes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProcess(p.id)}
                  className={`flex h-5 items-center gap-1 rounded px-1.5 text-ui-xs ${
                    p.id === activeProcessId
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <Circle
                    size={5}
                    weight="fill"
                    className={
                      p.status === "running"
                        ? "text-status-success"
                        : p.status === "failed"
                          ? "text-status-error"
                          : "text-muted-foreground"
                    }
                  />
                  {p.configName}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setActiveProcess(null)}
            className="flex h-5 items-center gap-1 rounded px-1.5 text-ui-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Back to Terminal"
          >
            <Terminal size={10} />
            <span>Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveProcess(null);
              removeProcess(activeProcess.id);
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-3 font-mono text-xs">
        {activeProcess.output.length === 0 ? (
          <span className="italic text-muted-foreground">No output yet...</span>
        ) : (
          activeProcess.output.map((line, i) => (
            <pre key={i} className="break-all whitespace-pre-wrap leading-relaxed text-foreground">
              {line}
            </pre>
          ))
        )}
      </div>
    </div>
  );
}
