"use client";

import { ArrowsInLineVertical, CaretDown } from "@phosphor-icons/react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { Separator } from "@/shared/components/ui/separator";

import { MessageResponse } from "../components/Message";

/// Marks where earlier messages were summarized; the summary opens on click.
export function CompactionMarker({ summary }: { summary: string }) {
  return (
    <Collapsible>
      <div className="flex items-center gap-2">
        <Separator className="flex-1" />
        <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-ui-2xs text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default">
          <ArrowsInLineVertical size={12} />
          <span>Earlier messages summarized</span>
          <CaretDown
            size={10}
            className="transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <Separator className="flex-1" />
      </div>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-ui-xs text-fg-muted">
          <MessageResponse streaming={false}>{summary}</MessageResponse>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
