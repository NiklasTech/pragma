import { useState } from "react";
import { CaretRight, CheckCircle, Circle, CircleNotch, ListChecks } from "@phosphor-icons/react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { cn } from "@/shared/lib/utils";

import { planProgress, type AcpPlanEntry } from "./sessionInfo";

function EntryIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-status-success" />;
  }
  if (status === "in_progress") {
    return (
      <CircleNotch
        size={14}
        weight="bold"
        className="mt-0.5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
      />
    );
  }
  return <Circle size={14} className="mt-0.5 shrink-0 text-fg-subtle" />;
}

/// The coding CLI's live plan above the composer; it folds away once every task is done.
export function AgentPlan({ entries }: { entries: AcpPlanEntry[] }) {
  const [open, setOpen] = useState<boolean | null>(null);
  if (entries.length === 0) return null;

  const { done, total } = planProgress(entries);
  const finished = done === total;
  const isOpen = open ?? !finished;
  const current = entries.find((entry) => entry.status === "in_progress");

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      className="rounded-xl border border-border bg-bg-surface"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-ui-xs text-fg-muted hover:text-fg-default">
        <CaretRight
          size={12}
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
        <ListChecks size={14} className="shrink-0" />
        <span className="shrink-0 font-medium text-fg-default">Plan</span>
        <span className="shrink-0 tabular-nums">
          {done} of {total} done
        </span>
        {!isOpen && current && (
          <span className="min-w-0 truncate text-fg-subtle">{current.content}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
        <ol className="flex max-h-48 flex-col gap-1 overflow-auto px-3 pb-2.5">
          {entries.map((entry, index) => (
            <li key={`${index}:${entry.content}`} className="flex items-start gap-2 text-ui-sm">
              <EntryIcon status={entry.status} />
              <span
                className={cn(
                  "min-w-0 break-words",
                  entry.status === "completed" && "text-fg-subtle line-through",
                  entry.status === "in_progress" && "text-fg-default",
                  entry.status === "pending" && "text-fg-muted",
                )}
              >
                {entry.content}
              </span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
