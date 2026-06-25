"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Scroll, Trash, X } from "@phosphor-icons/react";
import type { McpLogEvent } from "../hooks/useMcpServers";

interface McpServerLogSheetProps {
  serverId: string;
  serverName: string;
  logs: McpLogEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: (id: string) => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${time}.${ms}`;
}

export function McpServerLogSheet({
  serverId,
  serverName,
  logs,
  open,
  onOpenChange,
  onClear,
}: McpServerLogSheetProps) {
  const [autoScroll, setAutoScroll] = React.useState(true);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!autoScroll || !viewportRef.current) return;
    const viewport = viewportRef.current;
    viewport.scrollTop = viewport.scrollHeight;
  }, [logs, autoScroll]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[520px] flex-col sm:max-w-full" showCloseButton={false}>
        <SheetHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-ui-sm">Logs: {serverName}</SheetTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Switch
                  id={`autoscroll-${serverId}`}
                  size="sm"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                <Label htmlFor={`autoscroll-${serverId}`} className="text-ui-xs text-fg-muted">
                  Auto-scroll
                </Label>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Clear logs"
                onClick={() => onClear(serverId)}
              >
                <Trash size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Close"
                onClick={() => onOpenChange(false)}
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1 rounded-md border border-border/30 bg-bg-root">
          <div ref={viewportRef} className="p-3 font-mono text-ui-xs">
            {logs.length === 0 ? (
              <p className="text-fg-muted">No logs yet.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {logs.map((log, index) => (
                  <div key={index} className="break-all">
                    <span className="text-fg-subtle">[{formatTimestamp(log.timestamp)}]</span>{" "}
                    <span className="text-fg-default">{log.line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function LogButton({ onClick, logCount }: { onClick: () => void; logCount: number }) {
  return (
    <Button variant="ghost" size="icon-xs" title="View logs" onClick={onClick} className="relative">
      <Scroll size={14} />
      {logCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-fg-inverse">
          {logCount > 99 ? "99+" : logCount}
        </span>
      )}
    </Button>
  );
}
