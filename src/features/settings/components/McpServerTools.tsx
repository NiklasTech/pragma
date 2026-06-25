"use client";

import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { CaretDown, Wrench } from "@phosphor-icons/react";
import type { McpTool } from "../hooks/useMcpServers";

interface McpServerToolsProps {
  tools: McpTool[];
}

export function McpServerTools({ tools }: McpServerToolsProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-ui-xs text-fg-muted transition-colors hover:text-fg-default">
        <Wrench size={12} />
        <span>
          {tools.length} tool{tools.length === 1 ? "" : "s"}
        </span>
        <CaretDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-1.5 pl-5">
          {tools.length === 0 ? (
            <p className="text-ui-xs text-fg-subtle">No tools available.</p>
          ) : (
            tools.map((tool) => (
              <div key={tool.name} className="rounded-md border border-border/30 bg-bg-root p-2">
                <p className="font-medium text-ui-xs text-fg-default">{tool.name}</p>
                {tool.description && (
                  <p className="mt-0.5 text-ui-xs text-fg-muted">{tool.description}</p>
                )}
                {typeof tool.inputSchema === "object" &&
                  tool.inputSchema !== null &&
                  Object.keys(tool.inputSchema).length > 0 && (
                    <pre className="mt-1.5 overflow-auto rounded bg-bg-surface p-1.5 text-ui-xs text-fg-subtle">
                      {JSON.stringify(tool.inputSchema, null, 2)}
                    </pre>
                  )}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
