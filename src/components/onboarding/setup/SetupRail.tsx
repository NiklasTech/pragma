import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import {
  SECTION_LABELS,
  SETUP_SECTIONS,
  type SectionState,
  type SetupSection,
} from "./setupSections";

interface SetupRailProps {
  sections: Record<SetupSection, SectionState>;
  focus: SetupSection;
  onFocus: (section: SetupSection) => void;
}

/** A small square that tells done, in focus and still open apart. */
export function SectionCell({ done, focused }: { done: boolean; focused: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 shrink-0 rounded-[2px]",
        done
          ? "bg-status-success"
          : focused
            ? "bg-primary shadow-[0_0_0_3px_var(--color-accent-glow)]"
            : "ring-1 ring-fg-subtle ring-inset",
      )}
    />
  );
}

/// The setup sections with their state; a click or the number key brings one into focus.
export function SetupRail({ sections, focus, onFocus }: SetupRailProps) {
  return (
    <nav
      aria-label="Setup sections"
      className="flex w-[248px] shrink-0 flex-col rounded-well bg-bg-well px-3 py-[18px]"
    >
      <span className="px-2.5 pb-3 font-mono text-ui-2xs tracking-[0.08em] text-fg-subtle">
        SETUP
      </span>
      {SETUP_SECTIONS.map((section, index) => {
        const state = sections[section];
        const focused = focus === section;
        return (
          <Button
            key={section}
            variant="ghost"
            aria-current={focused ? "step" : undefined}
            onClick={() => onFocus(section)}
            className={cn(
              "h-[46px] justify-start gap-3 px-2.5 text-left font-normal",
              focused && "bg-accent-subtle hover:bg-accent-subtle",
            )}
          >
            <SectionCell done={state.done} focused={focused} />
            <span className="w-2.5 font-mono text-ui-2xs text-fg-subtle">{index + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-ui-base font-medium text-fg-default">
                {SECTION_LABELS[section]}
              </span>
              <span
                className={cn(
                  "truncate font-mono text-ui-2xs",
                  state.done ? "text-status-success" : focused ? "text-primary" : "text-fg-subtle",
                )}
              >
                {state.status}
              </span>
            </span>
          </Button>
        );
      })}
      <div className="flex-1" />
      <p className="px-2.5 text-ui-xs leading-normal text-fg-subtle">
        Only an agent is needed to start. Everything else stays in Settings.
      </p>
    </nav>
  );
}
