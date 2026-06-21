import { useCallback, useEffect } from "react";
import {
  ClockCounterClockwise,
  ArrowCounterClockwise,
  Spinner,
  FileText,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useLocalHistoryStore } from "@/shared/stores/localHistory";
import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface LocalHistoryPanelProps {
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LocalHistoryPanel({ filePath, isOpen, onClose }: LocalHistoryPanelProps) {
  const {
    snapshots,
    selectedSnapshotId,
    diffResult,
    isLoading,
    loadSnapshots,
    selectSnapshot,
    restoreSnapshot,
    clear,
  } = useLocalHistoryStore();

  useEffect(() => {
    if (isOpen && filePath) {
      void loadSnapshots(filePath);
    }
  }, [isOpen, filePath, loadSnapshots]);

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  const handleSelect = useCallback(
    (snapshotId: string) => {
      void selectSnapshot(filePath, snapshotId);
    },
    [filePath, selectSnapshot],
  );

  const handleRestore = useCallback(() => {
    if (!selectedSnapshotId) return;
    void restoreSnapshot(filePath, selectedSnapshotId);
  }, [filePath, selectedSnapshotId, restoreSnapshot]);

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] h-[80vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ClockCounterClockwise size={16} />
              Local History
              <span className="text-fg-muted font-normal">— {fileName}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-border/60 flex flex-col shrink-0">
            <div className="px-3 py-2 text-ui-xs font-semibold uppercase tracking-wider text-fg-muted border-b border-border/40">
              Snapshots
            </div>
            <ScrollArea className="flex-1">
              {isLoading && snapshots.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={16} className="animate-spin text-fg-muted" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="px-3 py-6 text-ui-xs text-fg-muted text-center">
                  No snapshots yet
                </div>
              ) : (
                <div className="py-1">
                  {snapshots.map((snap) => (
                    <button
                      key={snap.id}
                      onClick={() => handleSelect(snap.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-ui-xs flex flex-col gap-0.5 transition-colors",
                        selectedSnapshotId === snap.id
                          ? "bg-bg-active text-fg-default"
                          : "text-fg-default hover:bg-bg-hover",
                      )}
                    >
                      <span className="font-medium">{formatRelativeTime(snap.timestamp)}</span>
                      <span className="text-fg-muted text-ui-xs">{formatTime(snap.timestamp)}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selectedSnapshotId && diffResult ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0">
                  <span className="text-ui-xs text-fg-muted">
                    Snapshot from{" "}
                    {formatTime(
                      snapshots.find((s) => s.id === selectedSnapshotId)?.timestamp || "",
                    )}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-ui-xs gap-1"
                    onClick={handleRestore}
                    disabled={isLoading}
                  >
                    <ArrowCounterClockwise size={12} />
                    Restore
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  <InlineDiff
                    original={diffResult.original}
                    modified={diffResult.modified}
                    filePath={filePath}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-muted">
                <FileText size={24} className="opacity-40" />
                <span className="text-ui-xs">Select a snapshot to view diff</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
