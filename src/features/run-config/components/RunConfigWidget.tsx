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
import { useRunConfigStore, type RunConfig, type RunStatus } from "@/shared/stores/runConfig";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useLayoutStore } from "@/shell/layout/store";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";

function StatusDot({ status }: { status: RunStatus }) {
  const colorClass =
    status === "running"
      ? "text-status-success"
      : status === "failed"
        ? "text-status-error"
        : "text-fg-muted";

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
        isActive ? "bg-bg-active" : "bg-bg-active/40"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenOutput(process.id)}
        className="flex items-center gap-1.5"
        title="Open output"
      >
        <StatusDot status={process.status} />
        <span className="text-xs text-fg-default">{process.configName}</span>
      </button>
      <button
        type="button"
        onClick={() => onStop(process.id)}
        className="flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:text-status-error"
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
  const { addRunSession } = useTerminalStore();
  const { terminal, setTerminalMode } = useLayoutStore();

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
    async (config: RunConfig) => {
      const processId = await startConfig(config);
      if (processId) {
        if (terminal.mode === "hidden") {
          setTerminalMode("docked-bottom");
        }
        addRunSession(processId, config.name, config.command, resolveDefaultTerminalPanelId());
      }
    },
    [startConfig, addRunSession, terminal.mode, setTerminalMode],
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
      const process = processes.find((p) => p.id === id);
      const config = configs.find((c) => c.name === process?.configName);
      if (process && config) {
        if (terminal.mode === "hidden") {
          setTerminalMode("docked-bottom");
        }
        addRunSession(id, config.name, config.command, resolveDefaultTerminalPanelId());
      }
    },
    [setActiveProcess, addRunSession, processes, configs, terminal.mode, setTerminalMode],
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
          className="flex h-8 items-center gap-1.5 rounded-md px-3 text-ui-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <span>Run</span>
          <CaretDown size={12} />
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
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={proc?.status ?? "stopped"} />
                      <span className="text-xs text-fg-default">{config.name}</span>
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
                            className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:text-fg-default"
                            title="Open output"
                          >
                            <Terminal size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStop(proc.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:text-status-error"
                            title="Stop"
                          >
                            <Stop size={12} weight="fill" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (proc ? handleRestart(proc.id) : handleStart(config))}
                          className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:text-status-success"
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
                  className={`flex w-full items-center justify-between px-3 py-1.5 hover:bg-bg-hover ${
                    activeProcessId === proc.id ? "bg-bg-active/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={proc.status} />
                    <span className="text-xs text-fg-default">{proc.configName}</span>
                    {proc.exitCode !== null && (
                      <span className="text-ui-xs text-fg-muted">({proc.exitCode})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void restartProcess(proc.id);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:text-status-success"
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
                      className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:text-status-error"
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
