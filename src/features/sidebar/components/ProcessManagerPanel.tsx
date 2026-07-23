import { useEffect } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowClockwise,
  Circle,
  Play,
  Plus,
  Spinner,
  Stop,
  Terminal,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Switch } from "@/shared/components/ui/switch";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { cn } from "@/shared/lib/utils";
import { useLayoutStore } from "@/shell/layout/store";
import { useTerminalStore } from "@/shared/stores/terminal";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { useRunConfigStore, type RunConfig, type RunStatus } from "@/shared/stores/runConfig";

function StatusDot({ status }: { status: RunStatus }) {
  const colorClass =
    status === "running"
      ? "text-status-success"
      : status === "failed"
        ? "text-status-error"
        : "text-fg-muted";
  return <Circle size={6} weight="fill" className={cn("shrink-0", colorClass)} />;
}

function ConfigStatus({ status }: { status: RunStatus }) {
  if (status === "running") {
    return <span className="text-ui-xs text-status-success">running</span>;
  }
  if (status === "failed") {
    return <span className="text-ui-xs text-status-error">failed</span>;
  }
  return <span className="text-ui-xs text-fg-muted">stopped</span>;
}

function ProcessActionButton({
  icon: Icon,
  title,
  busy,
  onClick,
}: {
  icon: Icon;
  title: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40"
    >
      {busy ? <Spinner size={12} className="animate-spin" /> : <Icon size={12} />}
    </button>
  );
}

function DetectedConfigRow({
  config,
  onAccept,
  onReject,
}: {
  config: RunConfig;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-ui-sm font-medium text-fg-default">{config.name}</span>
        <span className="truncate text-ui-xs text-fg-muted" title={config.command}>
          {config.command}
        </span>
        {config.detect && (
          <span className="text-ui-xs text-fg-subtle">Detected: {config.detect}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onAccept}
          title="Add process"
          className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-success"
        >
          <Plus size={12} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onReject}
          title="Ignore suggestion"
          className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-error"
        >
          <Trash size={12} />
        </button>
      </div>
    </div>
  );
}

function SavedConfigRow({
  config,
  status,
  activeProcessId,
  processId,
  onStart,
  onStop,
  onRestart,
  onToggleAutoRestart,
  onRemove,
  onOpenLogs,
}: {
  config: RunConfig;
  status: RunStatus;
  activeProcessId: string | null;
  processId: string | undefined;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onToggleAutoRestart: () => void;
  onRemove: () => void;
  onOpenLogs: () => void;
}) {
  const isRunning = status === "running";
  const isActive = processId !== undefined && activeProcessId === processId;

  return (
    <div
      className={cn(
        "group flex flex-col gap-1 rounded-md px-2 py-1.5",
        isActive ? "bg-bg-active" : "hover:bg-bg-hover",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={status} />
        <span className="truncate text-ui-sm font-medium text-fg-default" title={config.name}>
          {config.name}
        </span>
        <ConfigStatus status={status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-ui-xs text-fg-muted" title={config.command}>
          {config.command}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {isRunning ? (
            <>
              <ProcessActionButton icon={Stop} title="Stop" busy={false} onClick={onStop} />
              <ProcessActionButton
                icon={ArrowClockwise}
                title="Restart"
                busy={false}
                onClick={onRestart}
              />
            </>
          ) : (
            <ProcessActionButton icon={Play} title="Start" busy={false} onClick={onStart} />
          )}
          <ProcessActionButton icon={Terminal} title="Logs" busy={false} onClick={onOpenLogs} />
          <ProcessActionButton icon={Trash} title="Remove" busy={false} onClick={onRemove} />
        </div>
        <label className="flex items-center gap-1.5 text-ui-xs text-fg-muted">
          <Switch
            checked={config.autoRestart}
            onCheckedChange={onToggleAutoRestart}
            className="scale-75"
          />
          Restart
        </label>
      </div>
    </div>
  );
}

function findConfigStatus(
  config: RunConfig,
  processes: ReturnType<typeof useRunConfigStore.getState>["processes"],
): { status: RunStatus; processId: string | undefined } {
  const matches = processes.filter((p) => p.configName === config.name);
  if (matches.length === 0) {
    return { status: "stopped", processId: undefined };
  }

  const running = matches.find((p) => p.status === "running");
  if (running) {
    return { status: "running", processId: running.id };
  }

  const failed = matches.find((p) => p.status === "failed");
  if (failed) {
    return { status: "failed", processId: failed.id };
  }

  return { status: "stopped", processId: matches[matches.length - 1]?.id };
}

export function ProcessManagerPanel() {
  const {
    configs,
    detectedConfigs,
    processes,
    activeProcessId,
    workspaceRoot,
    isLoading,
    isDetecting,
    detectConfigs,
    startConfig,
    stopProcess,
    restartProcess,
    setActiveProcess,
    removeConfig,
    updateConfig,
    acceptDetectedConfig,
    rejectDetectedConfig,
  } = useRunConfigStore();
  const { terminal, setTerminalMode } = useLayoutStore();
  const { addRunSession } = useTerminalStore();

  useEffect(() => {
    if (!workspaceRoot) return;
    void detectConfigs();
  }, [workspaceRoot, detectConfigs]);

  const refresh = () => {
    void detectConfigs();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={Terminal}
        title="Processes"
        subtitle={
          configs.length > 0
            ? `${configs.length} configuration${configs.length === 1 ? "" : "s"}`
            : undefined
        }
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={isDetecting}
            title="Refresh"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40 sm:size-7 sm:rounded-lg"
          >
            {isDetecting ? (
              <Spinner size={12} className="animate-spin" />
            ) : (
              <ArrowClockwise size={12} />
            )}
          </button>
        }
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size={18} className="animate-spin text-fg-muted" />
            </div>
          ) : !workspaceRoot ? (
            <PanelEmptyState
              icon={Warning}
              title="Open a workspace"
              description="Open a workspace to detect and manage processes."
            />
          ) : (
            <>
              {detectedConfigs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-ui-xs font-semibold uppercase tracking-wider text-fg-muted">
                      Detected
                    </span>
                    <span className="text-ui-xs text-fg-muted">{detectedConfigs.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {detectedConfigs.map((config, index) => (
                      <DetectedConfigRow
                        key={`detected-${config.name}`}
                        config={config}
                        onAccept={() => acceptDetectedConfig(index)}
                        onReject={() => rejectDetectedConfig(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-ui-xs font-semibold uppercase tracking-wider text-fg-muted">
                    Configurations
                  </span>
                  <span className="text-ui-xs text-fg-muted">{configs.length}</span>
                </div>
                {configs.length === 0 && detectedConfigs.length === 0 ? (
                  <PanelEmptyState
                    icon={Terminal}
                    title="No processes configured"
                    description="Detected configs will appear above, or add a run configuration manually."
                    className="py-4"
                  />
                ) : (
                  <div className="space-y-0.5">
                    {configs.map((config) => {
                      const { status, processId } = findConfigStatus(config, processes);
                      return (
                        <SavedConfigRow
                          key={config.id ?? config.name}
                          config={config}
                          status={status}
                          activeProcessId={activeProcessId}
                          processId={processId}
                          onStart={async () => {
                            const processId = await startConfig(config);
                            if (processId) {
                              if (terminal.mode === "hidden") {
                                setTerminalMode("docked-bottom");
                              }
                              addRunSession(
                                processId,
                                config.name,
                                config.command,
                                resolveDefaultTerminalPanelId(),
                              );
                            }
                          }}
                          onStop={() => processId && stopProcess(processId)}
                          onRestart={() => processId && restartProcess(processId)}
                          onToggleAutoRestart={() =>
                            config.id &&
                            updateConfig(config.id, { autoRestart: !config.autoRestart })
                          }
                          onRemove={() => config.id && removeConfig(config.id)}
                          onOpenLogs={() => {
                            if (processId) {
                              setActiveProcess(processId);
                              if (terminal.mode === "hidden") {
                                setTerminalMode("docked-bottom");
                              }
                              addRunSession(
                                processId,
                                config.name,
                                config.command,
                                resolveDefaultTerminalPanelId(),
                              );
                            } else {
                              setActiveProcess(null);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
