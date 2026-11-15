import { useShallow } from "zustand/react/shallow";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bug,
  Play,
  Stop,
  ArrowCounterClockwise,
  CaretDown,
  Circle,
  Trash,
  Terminal,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { useRunConfigStore, type RunConfig, type RunStatus } from "@/shared/stores/runConfig";
import { processLabel, repositoryProcesses } from "@/shared/stores/runProcesses";
import { useDebugStore } from "@/features/debug/store";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useLayoutStore } from "@/shell/layout/store";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { startRunConfig } from "../runTasks";

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
  label,
  isActive,
  onOpenOutput,
  onStop,
}: {
  process: { id: string; configName: string; status: RunStatus };
  label: string;
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
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onOpenOutput(process.id)}
        className="gap-1.5 px-1 font-normal text-fg-default"
        title="Open output"
      >
        <StatusDot status={process.status} />
        <span className="text-ui-xs text-fg-default">{label}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Stop"
        onClick={() => onStop(process.id)}
        className="text-fg-muted hover:text-status-error"
        title="Stop"
      >
        <Stop size={12} weight="fill" />
      </Button>
    </div>
  );
}

interface RunConfigWidgetProps {
  /** Shows only the running processes; macOS starts tasks from the Run menu instead. */
  runningOnly?: boolean;
}

export function RunConfigWidget({ runningOnly = false }: RunConfigWidgetProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    configs,
    processes,
    workspaceRoot,
    activeProcessId,
    setActiveProcess,
    stopProcess,
    restartProcess,
    removeProcess,
  } = useRunConfigStore(
    useShallow((s) => ({
      configs: s.configs,
      processes: s.processes,
      workspaceRoot: s.workspaceRoot,
      activeProcessId: s.activeProcessId,
      setActiveProcess: s.setActiveProcess,
      stopProcess: s.stopProcess,
      restartProcess: s.restartProcess,
      removeProcess: s.removeProcess,
    })),
  );
  const { addRunSession } = useTerminalStore(
    useShallow((s) => ({ addRunSession: s.addRunSession })),
  );
  const { terminal, setTerminalMode } = useLayoutStore(
    useShallow((s) => ({ terminal: s.terminal, setTerminalMode: s.setTerminalMode })),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStart = useCallback((config: RunConfig) => void startRunConfig(config), []);

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

  const handleDebug = useCallback((config: RunConfig) => {
    void useDebugStore.getState().startSession(config);
    setDropdownOpen(false);
  }, []);

  const handleOpenOutput = useCallback(
    (id: string) => {
      setActiveProcess(id);
      const process = processes.find((p) => p.id === id);
      if (process) {
        if (terminal.mode === "hidden") {
          setTerminalMode("docked-bottom");
        }
        addRunSession(id, process.configName, process.command, resolveDefaultTerminalPanelId());
      }
    },
    [setActiveProcess, addRunSession, processes, terminal.mode, setTerminalMode],
  );

  if (configs.length === 0 && processes.length === 0) {
    return null;
  }

  const ownProcesses = repositoryProcesses(processes, workspaceRoot);
  const runningProcesses = processes.filter((p) => p.status === "running");
  const stoppedProcesses = ownProcesses.filter((p) => p.status !== "running");

  return (
    <div className="flex items-center gap-1.5" ref={dropdownRef}>
      {/* Running processes — always visible */}
      {runningProcesses.map((proc) => (
        <RunningProcessBadge
          key={proc.id}
          process={proc}
          label={processLabel(proc, workspaceRoot)}
          isActive={activeProcessId === proc.id}
          onOpenOutput={handleOpenOutput}
          onStop={handleStop}
        />
      ))}

      {/* Dropdown for all configs + stopped processes */}
      <div className={runningOnly ? "hidden" : "relative"}>
        <Button
          variant="ghost"
          aria-expanded={dropdownOpen}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="h-8 gap-1.5 px-3 font-normal"
        >
          <span>Run</span>
          <CaretDown size={12} />
        </Button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg">
            <div className="py-1">
              {/* Section: Configs */}
              {configs.map((config) => {
                const proc = ownProcesses.find((p) => p.configName === config.name);
                return (
                  <div
                    key={config.name}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={proc?.status ?? "stopped"} />
                      <span className="text-ui-xs text-fg-default">{config.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {proc?.status === "running" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Open output"
                            onClick={() => {
                              handleOpenOutput(proc.id);
                              setDropdownOpen(false);
                            }}
                            className="text-fg-muted"
                            title="Open output"
                          >
                            <Terminal size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Stop"
                            onClick={() => handleStop(proc.id)}
                            className="text-fg-muted hover:text-status-error"
                            title="Stop"
                          >
                            <Stop size={12} weight="fill" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {config.debug && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Debug with ${config.debug.adapter}`}
                              onClick={() => handleDebug(config)}
                              className="text-fg-muted"
                              title={`Debug with ${config.debug.adapter}`}
                            >
                              <Bug size={12} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={proc ? "Restart" : "Start"}
                            onClick={() => (proc ? handleRestart(proc.id) : handleStart(config))}
                            className="text-fg-muted hover:text-status-success"
                            title={proc ? "Restart" : "Start"}
                          >
                            {proc ? (
                              <ArrowCounterClockwise size={12} />
                            ) : (
                              <Play size={12} weight="fill" />
                            )}
                          </Button>
                        </>
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
                <Button
                  variant="ghost"
                  key={proc.id}
                  onClick={() => {
                    setActiveProcess(activeProcessId === proc.id ? null : proc.id);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full justify-between rounded-none px-3 py-1.5 font-normal text-fg-default h-auto",
                    activeProcessId === proc.id && "bg-bg-active",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={proc.status} />
                    <span className="text-ui-xs text-fg-default">{proc.configName}</span>
                    {proc.exitCode !== null && (
                      <span className="text-ui-xs text-fg-muted">({proc.exitCode})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Restart"
                      onClick={(e) => {
                        e.stopPropagation();
                        void restartProcess(proc.id);
                      }}
                      className="text-fg-muted hover:text-status-success"
                      title="Restart"
                    >
                      <ArrowCounterClockwise size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProcess(proc.id);
                      }}
                      className="text-fg-muted hover:text-status-error"
                      title="Remove"
                    >
                      <Trash size={12} />
                    </Button>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
