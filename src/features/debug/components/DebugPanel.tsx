import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bug,
  CaretDown,
  CaretRight,
  DownloadSimple,
  Pause,
  Play,
  Plus,
  Spinner,
  Stop,
  X,
} from "@phosphor-icons/react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { cn } from "@/shared/lib/utils";
import { detectLanguage } from "@/shared/lib/language";
import { useEditorStore } from "@/shared/stores/editor";
import { useDebugStore } from "../store";
import {
  dapListAdapters,
  listenDapInstallProgress,
  type DapAdapterInfo,
  type DebugVariable,
} from "../client";
import { installAdapter } from "../adapterSetup";
import { debugCurrentFile } from "../debugCurrentFile";

function ToolbarButton({
  icon: Icon,
  title,
  disabled,
  onClick,
}: {
  icon: Icon;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40"
    >
      <Icon size={12} />
    </button>
  );
}

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-ui-xs font-semibold uppercase tracking-wider text-fg-muted">
        {title}
      </span>
      {count !== undefined && <span className="text-ui-xs text-fg-muted">{count}</span>}
    </div>
  );
}

function VariableNode({
  variable,
  depth,
  expanded,
  onToggle,
}: {
  variable: DebugVariable;
  depth: number;
  expanded: Set<number>;
  onToggle: (variablesReference: number) => void;
}) {
  const children = useDebugStore((state) => state.variables[variable.variablesReference]);
  const hasChildren = variable.variablesReference > 0;
  const isExpanded = hasChildren && expanded.has(variable.variablesReference);

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && onToggle(variable.variablesReference)}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-bg-hover"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <CaretDown size={10} className="shrink-0 text-fg-muted" />
          ) : (
            <CaretRight size={10} className="shrink-0 text-fg-muted" />
          )
        ) : (
          <span className="w-2.5 shrink-0" />
        )}
        <span className="truncate text-ui-xs text-fg-default">{variable.name}</span>
        <span className="truncate text-ui-xs text-fg-muted">{variable.value}</span>
      </button>
      {isExpanded &&
        children?.map((child) => (
          <VariableNode
            key={`${child.name}-${child.variablesReference}`}
            variable={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

function AdapterSetupSection() {
  const [adapters, setAdapters] = useState<DapAdapterInfo[] | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});

  const refresh = () => {
    dapListAdapters()
      .then(setAdapters)
      .catch(() => setAdapters([]));
  };

  useEffect(refresh, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listenDapInstallProgress((event) => {
      const suffix =
        event.stage === "downloading" && typeof event.percent === "number"
          ? ` ${event.percent}%`
          : "";
      setProgress((prev) => {
        const next = { ...prev };
        if (event.stage === "done" && next[event.adapterId]) {
          delete next[event.adapterId];
        } else {
          next[event.adapterId] = `${event.message}${suffix}`;
        }
        return next;
      });
      if (event.stage === "done" || event.stage === "error") {
        refresh();
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  const handleInstall = async (adapter: DapAdapterInfo) => {
    setInstallingId(adapter.id);
    await installAdapter(adapter);
    setInstallingId(null);
    refresh();
  };

  if (!adapters) return null;

  return (
    <div className="space-y-1.5">
      <SectionLabel title="Setup" />
      <div className="space-y-0.5">
        {adapters.map((adapter) => (
          <div key={adapter.id} className="rounded px-2 py-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    adapter.available ? "bg-status-success" : "bg-status-error",
                  )}
                />
                <span
                  className="truncate text-ui-xs text-fg-default"
                  title={adapter.install_hint ?? undefined}
                >
                  {adapter.label}
                </span>
              </div>
              {!adapter.available && (
                <button
                  type="button"
                  disabled={installingId !== null}
                  onClick={() => void handleInstall(adapter)}
                  title={adapter.install_hint ?? "Install adapter"}
                  className="flex h-5 shrink-0 items-center gap-1 rounded-md border border-border px-1.5 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40"
                >
                  {installingId === adapter.id ? (
                    <Spinner size={10} className="animate-spin" />
                  ) : (
                    <DownloadSimple size={10} />
                  )}
                  Install
                </button>
              )}
            </div>
            {progress[adapter.id] && (
              <div className="truncate pl-4 text-ui-xs text-fg-muted" title={progress[adapter.id]}>
                {progress[adapter.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

async function openFileAtLine(file: string, line: number) {
  try {
    const result = await invoke<{ path: string; name: string; content: string }>("read_text_file", {
      path: file,
    });
    const editor = useEditorStore.getState();
    editor.openFile({
      id: result.path,
      path: result.path,
      name: result.name,
      content: result.content,
      originalContent: result.content,
      isModified: false,
      language: detectLanguage(result.name),
    });
    editor.goToPosition(result.path, { line, column: 1 });
  } catch {
    // ignore
  }
}

export function DebugPanel() {
  const {
    breakpoints,
    status,
    statusError,
    sessionName,
    isStopped,
    stopReason,
    frames,
    selectedFrameId,
    scopes,
    watches,
    continueSession,
    pauseSession,
    stepOver,
    stepInto,
    stepOut,
    stopSession,
    selectFrame,
    loadVariables,
    addWatch,
    removeWatch,
    toggleBreakpoint,
  } = useDebugStore();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [watchInput, setWatchInput] = useState("");

  const frameScopes = selectedFrameId !== null ? (scopes[selectedFrameId] ?? []) : [];

  useEffect(() => {
    const first = frameScopes[0];
    if (first && !expanded.has(first.variablesReference)) {
      setExpanded((prev) => new Set(prev).add(first.variablesReference));
      void loadVariables(first.variablesReference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFrameId, frameScopes]);

  const handleToggle = (variablesReference: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(variablesReference)) {
        next.delete(variablesReference);
      } else {
        next.add(variablesReference);
      }
      return next;
    });
    if (!expanded.has(variablesReference)) {
      void loadVariables(variablesReference);
    }
  };

  const handleAddWatch = () => {
    addWatch(watchInput);
    setWatchInput("");
  };

  const isRunning = status === "running";
  const breakpointCount = Object.values(breakpoints).reduce((sum, lines) => sum + lines.length, 0);

  const subtitle =
    status === "inactive"
      ? undefined
      : status === "running"
        ? `${sessionName ?? "session"} — ${isStopped ? `paused (${stopReason ?? "stopped"})` : "running"}`
        : status === "starting"
          ? "starting"
          : (statusError ?? "error");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={Bug}
        title="Debug"
        subtitle={subtitle}
        actions={
          <>
            <ToolbarButton
              icon={Bug}
              title="Debug Current File"
              disabled={status === "running" || status === "starting"}
              onClick={() => void debugCurrentFile()}
            />
            <ToolbarButton
              icon={Play}
              title="Continue"
              disabled={!isRunning || !isStopped}
              onClick={() => void continueSession()}
            />
            <ToolbarButton
              icon={Pause}
              title="Pause"
              disabled={!isRunning || isStopped}
              onClick={() => void pauseSession()}
            />
            <ToolbarButton
              icon={ArrowRight}
              title="Step Over"
              disabled={!isStopped}
              onClick={() => void stepOver()}
            />
            <ToolbarButton
              icon={ArrowDown}
              title="Step Into"
              disabled={!isStopped}
              onClick={() => void stepInto()}
            />
            <ToolbarButton
              icon={ArrowUp}
              title="Step Out"
              disabled={!isStopped}
              onClick={() => void stepOut()}
            />
            <ToolbarButton
              icon={Stop}
              title="Stop"
              disabled={status !== "running" && status !== "starting"}
              onClick={() => void stopSession()}
            />
          </>
        }
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-2">
          {status === "inactive" && <AdapterSetupSection />}
          {status === "inactive" && breakpointCount === 0 ? (
            <PanelEmptyState
              icon={Bug}
              title="No debug session"
              description="Set breakpoints in the editor gutter, then start debugging from a run config with a debug adapter."
            />
          ) : (
            <>
              <div className="space-y-1.5">
                <SectionLabel title="Call Stack" count={frames.length} />
                <div className="space-y-0.5">
                  {frames.length === 0 ? (
                    <div className="px-1 py-1 text-ui-xs text-fg-muted">
                      {isRunning ? "Running" : "Not paused"}
                    </div>
                  ) : (
                    frames.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => void selectFrame(frame.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left",
                          frame.id === selectedFrameId ? "bg-bg-active" : "hover:bg-bg-hover",
                        )}
                      >
                        <span className="truncate text-ui-xs text-fg-default">{frame.name}</span>
                        <span className="shrink-0 text-ui-xs text-fg-muted">
                          {frame.source?.name ?? "unknown"}:{frame.line}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {isStopped && selectedFrameId !== null && (
                <div className="space-y-1.5">
                  <SectionLabel title="Variables" />
                  <div className="space-y-0.5">
                    {frameScopes.map((scope) => (
                      <VariableNode
                        key={scope.variablesReference}
                        variable={{
                          name: scope.name,
                          value: "",
                          variablesReference: scope.variablesReference,
                        }}
                        depth={0}
                        expanded={expanded}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <SectionLabel title="Watch" count={watches.length} />
                <div className="flex items-center gap-1 px-1">
                  <input
                    type="text"
                    value={watchInput}
                    onChange={(e) => setWatchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddWatch();
                    }}
                    placeholder="Add expression"
                    className="h-6 min-w-0 flex-1 rounded-md border border-border bg-bg-surface px-2 text-ui-xs text-fg-default outline-none placeholder:text-fg-subtle focus:border-primary/50"
                  />
                  <ToolbarButton
                    icon={Plus}
                    title="Add watch"
                    disabled={!watchInput.trim()}
                    onClick={handleAddWatch}
                  />
                </div>
                <div className="space-y-0.5">
                  {watches.map((watch) => (
                    <div
                      key={watch.id}
                      className="group flex items-center justify-between gap-2 rounded px-2 py-0.5 hover:bg-bg-hover"
                    >
                      <span className="truncate text-ui-xs text-fg-default">
                        {watch.expression}
                      </span>
                      <span
                        className={cn(
                          "truncate text-ui-xs",
                          watch.error ? "text-status-error" : "text-fg-muted",
                        )}
                        title={watch.error ?? watch.value}
                      >
                        {watch.error ?? watch.value ?? "..."}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWatch(watch.id)}
                        title="Remove watch"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <SectionLabel title="Breakpoints" count={breakpointCount} />
                <div className="space-y-0.5">
                  {Object.entries(breakpoints).flatMap(([file, lines]) =>
                    lines.map((line) => (
                      <div
                        key={`${file}:${line}`}
                        className="group flex items-center justify-between gap-2 rounded px-2 py-0.5 hover:bg-bg-hover"
                      >
                        <button
                          type="button"
                          onClick={() => void openFileAtLine(file, line)}
                          className="flex min-w-0 items-center gap-2 text-left"
                          title={file}
                        >
                          <span className="size-2 shrink-0 rounded-full bg-[#e51400]" />
                          <span className="truncate text-ui-xs text-fg-default">
                            {file.split(/[\\/]/).pop() ?? file}:{line}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBreakpoint(file, line)}
                          title="Remove breakpoint"
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )),
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
