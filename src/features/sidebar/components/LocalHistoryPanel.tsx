import { useCallback, useEffect } from "react";
import {
  ClockCounterClockwise,
  ArrowCounterClockwise,
  Spinner,
  FileText,
  GitCommit,
  FloppyDisk,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useLocalHistoryStore, type HistoryEntry } from "@/shared/stores/localHistory";
import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";

function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

interface LocalHistoryPanelProps {
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LocalHistoryPanel({ filePath, isOpen, onClose }: LocalHistoryPanelProps) {
  const {
    entries,
    selectedEntry,
    diffResult,
    isLoading,
    loadEntries,
    selectEntry,
    restoreEntry,
    clear,
  } = useLocalHistoryStore();

  useEffect(() => {
    if (isOpen && filePath) {
      void loadEntries(filePath);
    }
  }, [isOpen, filePath, loadEntries]);

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  const handleSelect = useCallback(
    (entry: HistoryEntry) => {
      void selectEntry(filePath, entry);
    },
    [filePath, selectEntry],
  );

  const handleRestore = useCallback(() => {
    if (!selectedEntry) return;
    void restoreEntry(filePath, selectedEntry);
  }, [filePath, selectedEntry, restoreEntry]);

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ClockCounterClockwise size={16} />
              Local History
              <span className="text-fg-muted font-normal">— {fileName}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-border flex flex-col shrink-0">
            <div className="px-3 py-2 text-ui-xs font-semibold uppercase tracking-wider text-fg-muted border-b border-border">
              History
            </div>
            <ScrollArea className="flex-1">
              {isLoading && entries.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={16} className="animate-spin text-fg-muted" />
                </div>
              ) : entries.length === 0 ? (
                <div className="px-3 py-6 text-ui-xs text-fg-muted text-center">
                  No history available
                </div>
              ) : (
                <div className="py-1">
                  {entries.map((entry) => (
                    <button
                      key={`${entry.kind}-${entry.id}`}
                      onClick={() => handleSelect(entry)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-ui-xs flex flex-col gap-0.5 transition-colors",
                        selectedEntry?.id === entry.id && selectedEntry?.kind === entry.kind
                          ? "bg-bg-active text-fg-default"
                          : "text-fg-default hover:bg-bg-hover",
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        {entry.kind === "git" ? (
                          <GitCommit size={12} className="text-fg-muted" />
                        ) : (
                          <FloppyDisk size={12} className="text-fg-muted" />
                        )}
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                      <span className="text-fg-muted text-ui-xs truncate pl-4">
                        {entry.kind === "git" ? entry.message : "Auto-saved"}
                      </span>
                      <span className="text-fg-subtle text-ui-2xs pl-4">
                        {entry.kind === "git" ? `${entry.author} • ` : ""}
                        {formatTime(entry.timestamp)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selectedEntry && diffResult ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                  <span className="text-ui-xs text-fg-muted truncate pr-4">
                    {selectedEntry.kind === "git"
                      ? `${selectedEntry.message} — ${selectedEntry.author}`
                      : `Auto-saved — ${formatDateTime(selectedEntry.timestamp)}`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-ui-xs gap-1 shrink-0"
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
                    patchText={diffResult.patchText}
                    filePath={filePath}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-muted">
                <FileText size={24} className="opacity-40" />
                <span className="text-ui-xs">Select an entry to view diff</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
