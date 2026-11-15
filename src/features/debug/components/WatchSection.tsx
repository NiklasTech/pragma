import { Plus, X } from "@phosphor-icons/react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useDebugStore } from "../store";
import { SectionLabel, ToolbarButton } from "./DebugPanelParts";

interface WatchSectionProps {
  watchInput: string;
  onWatchInputChange: (value: string) => void;
}

export function WatchSection({ watchInput, onWatchInputChange }: WatchSectionProps) {
  const watches = useDebugStore((state) => state.watches);
  const addWatch = useDebugStore((state) => state.addWatch);
  const removeWatch = useDebugStore((state) => state.removeWatch);

  const handleAddWatch = () => {
    addWatch(watchInput);
    onWatchInputChange("");
  };

  return (
    <div className="space-y-1.5">
      <SectionLabel title="Watch" count={watches.length} />
      <div className="flex items-center gap-1 px-1">
        <Input
          type="text"
          value={watchInput}
          onChange={(e) => onWatchInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddWatch();
          }}
          placeholder="Add expression"
          className="h-6 flex-1 px-2 text-ui-xs"
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
            <span className="truncate text-ui-xs text-fg-default">{watch.expression}</span>
            <span
              className={cn(
                "truncate text-ui-xs",
                watch.error ? "text-status-error" : "text-fg-muted",
              )}
              title={watch.error ?? watch.value}
            >
              {watch.error ?? watch.value ?? "..."}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove watch"
              onClick={() => removeWatch(watch.id)}
              title="Remove watch"
              className="size-4 text-fg-muted opacity-0 group-hover:opacity-100 hover:text-status-error"
            >
              <X size={10} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
