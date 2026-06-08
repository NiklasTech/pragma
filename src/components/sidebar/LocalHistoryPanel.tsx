import { useCallback, useEffect } from "react";
import {
  ClockCounterClockwise,
  ArrowCounterClockwise,
  Spinner,
  FileText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocalHistoryStore } from "@/stores/localHistory";
import { InlineDiff } from "@/components/editor/InlineDiff";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
              <span className="text-muted-foreground font-normal">— {fileName}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-border/60 flex flex-col shrink-0">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
              Snapshots
            </div>
            <ScrollArea className="flex-1">
              {isLoading && snapshots.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="px-3 py-6 text-[11px] text-muted-foreground text-center">
                  No snapshots yet
                </div>
              ) : (
                <div className="py-1">
                  {snapshots.map((snap) => (
                    <button
                      key={snap.id}
                      onClick={() => handleSelect(snap.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-[11px] flex flex-col gap-0.5 transition-colors",
                        selectedSnapshotId === snap.id
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/40",
                      )}
                    >
                      <span className="font-medium">{formatRelativeTime(snap.timestamp)}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {formatTime(snap.timestamp)}
                      </span>
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
                  <span className="text-[11px] text-muted-foreground">
                    Snapshot from{" "}
                    {formatTime(
                      snapshots.find((s) => s.id === selectedSnapshotId)?.timestamp || "",
                    )}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] gap-1"
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
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileText size={24} className="opacity-40" />
                <span className="text-[11px]">Select a snapshot to view diff</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
