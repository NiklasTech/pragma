import { Lightning } from "@phosphor-icons/react";

import { Badge } from "@/shared/components/ui/badge";
import { Kbd } from "@/shared/components/ui/kbd";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

interface AISuggestionsOverlayProps {
  suggestion: string;
  loading: boolean;
  visible: boolean;
}

export function AISuggestionsOverlay({ suggestion, loading, visible }: AISuggestionsOverlayProps) {
  if (!visible && !loading) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[80%] items-center gap-2 rounded-md border border-border/50 bg-background/95 px-2 py-1.5 shadow-md backdrop-blur-sm",
        !visible && loading && "opacity-70",
      )}
    >
      <Badge variant="outline" className="shrink-0 gap-1">
        <Lightning size={12} weight="fill" />
        AI
      </Badge>

      {loading && !suggestion ? (
        <Skeleton className="h-4 w-32" />
      ) : (
        <span className="truncate font-mono text-sm text-muted-foreground">{suggestion}</span>
      )}

      <div className="ml-1 flex shrink-0 items-center gap-1">
        <Kbd>Tab</Kbd>
        <span className="text-ui-xs text-muted-foreground">to accept</span>
      </div>
    </div>
  );
}
