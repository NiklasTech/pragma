import { useEffect, useMemo, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Circle,
  Cube,
  Play,
  Plus,
  Spinner,
  Stop,
  Terminal,
  TextAlignLeft,
  Warning,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDockerStore, type DockerContainer } from "@/stores/docker";

function isProjectContainer(container: DockerContainer, projectName: string | null): boolean {
  if (!projectName) return false;
  const composeProject = container.labels["com.docker.compose.project"];
  return composeProject === projectName;
}

function StatusDot({ state }: { state: string }) {
  const normalized = state.toLowerCase();
  const color =
    normalized === "running"
      ? "text-emerald-400"
      : normalized === "exited" || normalized === "dead"
        ? "text-rose-400"
        : "text-amber-400";
  return <Circle size={7} weight="fill" className={cn("shrink-0", color)} />;
}

function ContainerRow({
  container,
  actionBusy,
  onStart,
  onStop,
  onRestart,
  onLogs,
  onExec,
}: {
  container: DockerContainer;
  actionBusy: string | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onLogs: (c: DockerContainer) => void;
  onExec: (c: DockerContainer) => void;
}) {
  const isRunning = container.state.toLowerCase() === "running";
  const name = container.names[0] ?? container.id.slice(0, 12);
  const busy =
    actionBusy === `start-${container.id}` ||
    actionBusy === `stop-${container.id}` ||
    actionBusy === `restart-${container.id}`;

  return (
    <div className="group flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-accent/40">
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot state={container.state} />
        <span className="truncate text-[12px] font-medium text-foreground" title={name}>
          {name}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-muted-foreground" title={container.image}>
          {container.image}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground capitalize">
          {container.status}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {isRunning ? (
          <>
            <DockerActionButton
              icon={Stop}
              title="Stop"
              busy={busy}
              onClick={() => onStop(container.id)}
            />
            <DockerActionButton
              icon={ArrowClockwise}
              title="Restart"
              busy={busy}
              onClick={() => onRestart(container.id)}
            />
            <DockerActionButton
              icon={TextAlignLeft}
              title="Logs"
              busy={busy}
              onClick={() => onLogs(container)}
            />
            <DockerActionButton
              icon={Terminal}
              title="Shell"
              busy={busy}
              onClick={() => onExec(container)}
            />
          </>
        ) : (
          <>
            <DockerActionButton
              icon={Play}
              title="Start"
              busy={busy}
              onClick={() => onStart(container.id)}
            />
            <DockerActionButton
              icon={TextAlignLeft}
              title="Logs"
              busy={busy}
              onClick={() => onLogs(container)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function DockerActionButton({
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
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
    >
      {busy ? <Spinner size={12} className="animate-spin" /> : <Icon size={12} />}
    </button>
  );
}

export function ContainerGroup({
  title,
  containers,
  defaultOpen,
  actionBusy,
  onStart,
  onStop,
  onRestart,
  onLogs,
  onExec,
}: {
  title: string;
  containers: DockerContainer[];
  defaultOpen: boolean;
  actionBusy: string | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onLogs: (c: DockerContainer) => void;
  onExec: (c: DockerContainer) => void;
}) {
  if (containers.length === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-1 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
        <span className="flex items-center gap-1.5">
          {title}
          <span className="rounded-full bg-accent px-1.5 py-0 text-[9px] text-foreground">
            {containers.length}
          </span>
        </span>
        <CaretDown size={11} className="transition-transform group-data-[state=closed]:hidden" />
        <CaretRight size={11} className="transition-transform group-data-[state=open]:hidden" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-0.5 space-y-0.5">
          {containers.map((container) => (
            <ContainerRow
              key={container.id}
              container={container}
              actionBusy={actionBusy}
              onStart={onStart}
              onStop={onStop}
              onRestart={onRestart}
              onLogs={onLogs}
              onExec={onExec}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DockerPanel() {
  const {
    containers,
    runtime,
    isLoading,
    runtimeLoading,
    actionBusy,
    error,
    workspaceRoot,
    loadContainers,
    loadRuntimeInfo,
    startContainer,
    stopContainer,
    restartContainer,
    composeUp,
    composeDown,
    composeBuild,
    composeRestart,
    openLogsTab,
    openExecTab,
  } = useDockerStore();

  const [statsEnabled, setStatsEnabled] = useState(false);

  useEffect(() => {
    void loadRuntimeInfo();
  }, [workspaceRoot, loadRuntimeInfo]);

  useEffect(() => {
    if (!runtime?.available) return;
    void loadContainers();
    const interval = window.setInterval(() => {
      void loadContainers();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [runtime?.available, loadContainers]);

  const composeBusy =
    actionBusy === "compose-up" ||
    actionBusy === "compose-down" ||
    actionBusy === "compose-build" ||
    actionBusy === "compose-restart";

  const projectName = runtime?.compose_project_name ?? null;
  const { projectContainers, otherContainers } = useMemo(() => {
    const project: DockerContainer[] = [];
    const other: DockerContainer[] = [];
    for (const container of containers) {
      if (isProjectContainer(container, projectName)) {
        project.push(container);
      } else {
        other.push(container);
      }
    }
    return { projectContainers: project, otherContainers: other };
  }, [containers, projectName]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Cube size={16} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Docker</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void loadContainers()}
            disabled={isLoading}
            title="Refresh"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            {isLoading ? (
              <Spinner size={12} className="animate-spin" />
            ) : (
              <ArrowClockwise size={12} />
            )}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-2">
          {runtimeLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : runtime === null ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Warning size={20} className="text-amber-400" />
              <p className="text-xs text-muted-foreground">Failed to detect Docker runtime.</p>
              {error && <p className="text-[10px] text-destructive">{error}</p>}
            </div>
          ) : !runtime.available ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Warning size={20} className="text-amber-400" />
              <p className="text-xs text-muted-foreground">
                Docker or Podman is not available on this system.
              </p>
              <p className="text-[10px] text-muted-foreground">
                Shell: /bin/fish · PATH entries: check Tauri log
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md bg-accent/30 px-2 py-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {runtime.runtime} {runtime.version}
                </span>
                <span className="text-[10px] text-emerald-400">connected</span>
              </div>

              {error && <p className="text-[11px] text-destructive px-1">{error}</p>}

              {runtime.compose_file && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Compose
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {runtime.compose_file}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <ComposeButton label="Up" busy={composeBusy} onClick={() => void composeUp()} />
                    <ComposeButton
                      label="Down"
                      busy={composeBusy}
                      onClick={() => void composeDown()}
                    />
                    <ComposeButton
                      label="Build"
                      busy={composeBusy}
                      onClick={() => void composeBuild()}
                    />
                    <ComposeButton
                      label="Restart"
                      busy={composeBusy}
                      onClick={() => void composeRestart()}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Containers
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatsEnabled((v) => !v)}
                    className={cn(
                      "text-[10px] transition-colors",
                      statsEnabled ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Stats
                  </button>
                </div>
                {containers.length === 0 ? (
                  <p className="px-1 py-3 text-[11px] text-muted-foreground text-center">
                    No containers found.
                  </p>
                ) : (
                  <>
                    <ContainerGroup
                      title="Project"
                      defaultOpen
                      containers={projectContainers}
                      actionBusy={actionBusy}
                      onStart={(id) => void startContainer(id)}
                      onStop={(id) => void stopContainer(id)}
                      onRestart={(id) => void restartContainer(id)}
                      onLogs={(c) => openLogsTab(c)}
                      onExec={(c) => openExecTab(c)}
                    />
                    <ContainerGroup
                      title="Other"
                      defaultOpen={false}
                      containers={otherContainers}
                      actionBusy={actionBusy}
                      onStart={(id) => void startContainer(id)}
                      onStop={(id) => void stopContainer(id)}
                      onRestart={(id) => void restartContainer(id)}
                      onLogs={(c) => openLogsTab(c)}
                      onExec={(c) => openExecTab(c)}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ComposeButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={onClick}
      className="h-6 text-[10.5px] px-2 py-0"
    >
      {busy ? (
        <Spinner size={11} className="animate-spin mr-1" />
      ) : (
        <Plus size={11} className="mr-1" />
      )}
      {label}
    </Button>
  );
}
