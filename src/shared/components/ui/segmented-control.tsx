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
        "inline-flex overflow-hidden rounded-[5px] ring-1 ring-fg-default/15 ring-inset",
        className,
      )}
    >
      {options.map((option) => (
        <Toggle<Value>
          key={option.value}
          value={option.value}
          className="inline-flex h-6.5 items-center gap-1.5 px-2.5 font-mono text-[11.5px] whitespace-nowrap text-fg-subtle transition-colors outline-none not-first:border-l not-first:border-fg-default/15 before:hidden before:size-1.5 before:rounded-[1px] before:bg-primary hover:text-fg-default focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset data-[pressed]:bg-primary/10 data-[pressed]:text-fg-default data-[pressed]:before:block"
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
