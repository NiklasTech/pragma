import { Plus, X } from "@phosphor-icons/react";
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
        <input
          type="text"
          value={watchInput}
          onChange={(e) => onWatchInputChange(e.target.value)}
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
  );
}
