import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Stop,
  ArrowCounterClockwise,
  CaretDown,
  Circle,
  Trash,
  Terminal,
} from "@phosphor-icons/react";
import { useRunConfigStore, type RunConfig, type RunStatus } from "@/stores/runConfig";

function StatusDot({ status }: { status: RunStatus }) {
  const colorClass =
    status === "running"
      ? "text-green-500"
      : status === "failed"
        ? "text-red-500"
        : "text-muted-foreground";

  return <Circle size={6} weight="fill" className={colorClass} />;
}

function RunningProcessBadge({
  process,
  isActive,
  onOpenOutput,
  onStop,
}: {
  process: { id: string; configName: string; status: RunStatus };
  isActive: boolean;
  onOpenOutput: (id: string) => void;
  onStop: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded px-2 py-0.5 transition-colors ${
        isActive ? "bg-accent" : "bg-accent/40"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenOutput(process.id)}
        className="flex items-center gap-1.5"
        title="Open output"
      >
        <StatusDot status={process.status} />
        <span className="text-xs text-foreground">{process.configName}</span>
      </button>
      <button
        type="button"
        onClick={() => onStop(process.id)}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-red-400"
        title="Stop"
      >
        <Stop size={12} weight="fill" />
      </button>
    </div>
  );
}

export function RunConfigWidget() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    configs,
    processes,
    activeProcessId,
    setActiveProcess,
    startConfig,
    stopProcess,
    restartProcess,
    removeProcess,
  } = useRunConfigStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStart = useCallback(
    (config: RunConfig) => {
      void startConfig(config);
    },
    [startConfig],
  );

  const handleStop = useCallback(
    (id: string) => {
      void stopProcess(id);
    },
    [stopProcess],
  );

  const handleRestart = useCallback(
    (id: string) => {
      void restartProcess(id);
    },
    [restartProcess],
  );

  const handleOpenOutput = useCallback(
    (id: string) => {
      setActiveProcess(id);
    },
    [setActiveProcess],
  );

  if (configs.length === 0 && processes.length === 0) {
    return null;
  }

  const runningProcesses = processes.filter((p) => p.status === "running");
  const stoppedProcesses = processes.filter((p) => p.status !== "running");

  return (
    <div className="flex items-center gap-1.5" ref={dropdownRef}>
      {/* Running processes — always visible */}
      {runningProcesses.map((proc) => (
        <RunningProcessBadge
          key={proc.id}
          process={proc}
          isActive={activeProcessId === proc.id}
          onOpenOutput={handleOpenOutput}
          onStop={handleStop}
        />
      ))}

      {/* Dropdown for all configs + stopped processes */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex h-6 items-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span>Run</span>
          <CaretDown size={10} />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg">
            <div className="py-1">
              {/* Section: Configs */}
              {configs.map((config) => {
                const proc = processes.find((p) => p.configName === config.name);
                return (
                  <div
                    key={config.name}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={proc?.status ?? "stopped"} />
                      <span className="text-xs text-foreground">{config.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {proc?.status === "running" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenOutput(proc.id);
                              setDropdownOpen(false);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            title="Open output"
                          >
                            <Terminal size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStop(proc.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-400"
                            title="Stop"
                          >
                            <Stop size={12} weight="fill" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (proc ? handleRestart(proc.id) : handleStart(config))}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-green-400"
                          title={proc ? "Restart" : "Start"}
                        >
                          {proc ? (
                            <ArrowCounterClockwise size={12} />
                          ) : (
                            <Play size={12} weight="fill" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Section: Stopped processes */}
              {stoppedProcesses.length > 0 && configs.length > 0 && (
                <div className="my-1 border-t border-border" />
              )}
              {stoppedProcesses.map((proc) => (
                <button
                  key={proc.id}
                  type="button"
                  onClick={() => {
                    setActiveProcess(activeProcessId === proc.id ? null : proc.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-accent ${
                    activeProcessId === proc.id ? "bg-accent/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={proc.status} />
                    <span className="text-xs text-foreground">{proc.configName}</span>
                    {proc.exitCode !== null && (
                      <span className="text-[10px] text-muted-foreground">({proc.exitCode})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void restartProcess(proc.id);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-green-400"
                      title="Restart"
                    >
                      <ArrowCounterClockwise size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProcess(proc.id);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-400"
                      title="Remove"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
