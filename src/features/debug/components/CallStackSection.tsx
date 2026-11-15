import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useDebugStore } from "../store";
import { SectionLabel } from "./DebugPanelParts";

export function CallStackSection({ isRunning }: { isRunning: boolean }) {
  const frames = useDebugStore((state) => state.frames);
  const selectedFrameId = useDebugStore((state) => state.selectedFrameId);
  const selectFrame = useDebugStore((state) => state.selectFrame);

  return (
    <div className="space-y-1.5">
      <SectionLabel title="Call Stack" count={frames.length} />
      <div className="space-y-0.5">
        {frames.length === 0 ? (
          <div className="px-1 py-1 text-ui-xs text-fg-muted">
            {isRunning ? "Running" : "Not paused"}
          </div>
        ) : (
          frames.map((frame) => (
            <Button
              variant="ghost"
              size="xs"
              key={frame.id}
              onClick={() => void selectFrame(frame.id)}
              className={cn(
                "h-6 w-full justify-between gap-2 px-2 text-left font-normal",
                frame.id === selectedFrameId && "bg-bg-active",
              )}
            >
              <span className="truncate text-ui-xs text-fg-default">{frame.name}</span>
              <span className="shrink-0 text-ui-xs text-fg-muted">
                {frame.source?.name ?? "unknown"}:{frame.line}
              </span>
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
