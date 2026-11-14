import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

import { cn } from "@/shared/lib/utils";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: React.ReactNode;
  /** A small number after the label, for example how many items the segment shows. */
  count?: number;
}

interface SegmentedControlProps<Value extends string> {
  value: Value;
  onValueChange: (value: Value) => void;
  options: SegmentedOption<Value>[];
  /** Names the group for screen readers. */
  label: string;
  className?: string;
}

/** One choice out of a few, always with one segment selected. */
export function SegmentedControl<Value extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<Value>) {
  return (
    <ToggleGroup<Value>
      data-slot="segmented-control"
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        // Pressing the selected segment again would leave nothing selected.
        const picked = next[0];
        if (picked !== undefined) onValueChange(picked);
      }}
      className={cn(
        "inline-flex rounded-[9px] bg-bg-input p-0.5 ring-1 ring-border-subtle ring-inset",
        className,
      )}
    >
      {options.map((option) => (
        <Toggle<Value>
          key={option.value}
          value={option.value}
          className="inline-flex h-6.5 items-center gap-1.5 rounded-[7px] px-2.5 text-ui-sm whitespace-nowrap text-fg-muted transition-colors outline-none hover:text-fg-default focus-visible:ring-2 focus-visible:ring-border-focus data-[pressed]:bg-bg-active data-[pressed]:text-fg-default"
        >
          {option.label}
          {option.count !== undefined && (
            <span className="text-ui-2xs text-fg-subtle tabular-nums">{option.count}</span>
          )}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
