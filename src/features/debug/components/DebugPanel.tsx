import { useEffect, useState } from "react";
import { Bug } from "@phosphor-icons/react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { useDebugStore } from "../store";
import { SectionLabel } from "./DebugPanelParts";
import { VariableNode } from "./VariableNode";
import { AdapterSetupSection } from "./AdapterSetupSection";
import { DebugToolbar } from "./DebugToolbar";
import { CallStackSection } from "./CallStackSection";
import { WatchSection } from "./WatchSection";
import { BreakpointsSection } from "./BreakpointsSection";

export function DebugPanel() {
  const {
    breakpoints,
    status,
    statusError,
    sessionName,
    isStopped,
    stopReason,
    selectedFrameId,
    scopes,
    loadVariables,
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
      <PanelHeader title={subtitle} actions={<DebugToolbar />} />

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
              <CallStackSection isRunning={isRunning} />

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

              <WatchSection watchInput={watchInput} onWatchInputChange={setWatchInput} />

              <BreakpointsSection breakpointCount={breakpointCount} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
