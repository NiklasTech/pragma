import { useMemo } from "react";
import { Robot, TerminalWindow } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { showSessionInPane } from "./open";
import { CHILD_STATUS_LABELS, isChildRunning } from "./status";
import { useSessionStatuses } from "./useSessionStatuses";

interface ChildSessionCardProps {
  sessionId: string;
  title: string;
}

export function ChildSessionCard({ sessionId, title }: ChildSessionCardProps) {
  const session = useAIStore((state) => state.chatSessions.find((item) => item.id === sessionId));
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const tracked = useMemo(() => (session ? [session] : []), [session]);
  const status = useSessionStatuses(tracked).get(sessionId) ?? null;
  const available = session !== undefined && !session.archived;
  const Icon = session?.kind === "terminal" ? TerminalWindow : Robot;

  return (
    <div className="my-1 flex items-center gap-2.5 rounded-xl border border-border-subtle bg-bg-surface px-3 py-2">
      <Icon size={15} className="shrink-0 text-fg-muted" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ui-sm text-fg-default" title={session?.title ?? title}>
          Started {session?.title ?? title}
        </span>
        <span
          className={cn(
            "text-ui-2xs text-fg-subtle",
            status && isChildRunning(status) && "text-primary",
            status === "error" && "text-status-error",
          )}
        >
          {!session
            ? "Session removed"
            : session.archived
              ? "Archived"
              : status && CHILD_STATUS_LABELS[status]}
        </span>
      </div>
      {available && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full px-3"
          onClick={() => showSessionInPane(rootPath, sessionId)}
        >
          Open
        </Button>
      )}
    </div>
  );
}
