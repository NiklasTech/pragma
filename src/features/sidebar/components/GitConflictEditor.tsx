import { useEffect, useMemo, useState } from "react";
import { Spinner, Warning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { cn } from "@/shared/lib/utils";
import { useGitStore } from "@/shared/stores/git";
import {
  acceptFileResolution,
  hasConflictMarkers,
  parseConflictHunks,
  resolveConflictContent,
  type ConflictResolution,
} from "./gitConflict";

const RESOLUTIONS: { value: ConflictResolution; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "incoming", label: "Incoming" },
  { value: "both", label: "Both" },
];

export function GitConflictEditor() {
  const path = useGitStore((state) => state.conflictPath);
  const sides = useGitStore((state) => state.conflictSides);
  const loading = useGitStore((state) => state.conflictLoading);
  const closeConflict = useGitStore((state) => state.closeConflict);
  const resolveConflict = useGitStore((state) => state.resolveConflict);
  const markConflictResolved = useGitStore((state) => state.markConflictResolved);

  const [choices, setChoices] = useState<Record<number, ConflictResolution>>({});
  const [showBase, setShowBase] = useState(false);

  useEffect(() => {
    setChoices({});
    setShowBase(false);
  }, [path]);

  const hunks = useMemo(() => (sides ? parseConflictHunks(sides.worktree_content) : []), [sides]);

  const unresolvedMarkers = sides ? hasConflictMarkers(sides.worktree_content) : false;

  const handleApplyHunks = () => {
    if (!path || !sides) return;
    void resolveConflict(path, resolveConflictContent(sides.worktree_content, choices));
  };

  const handleFileResolution = (resolution: ConflictResolution) => {
    if (!path || !sides) return;
    void resolveConflict(
      path,
      acceptFileResolution(sides.current_content, sides.incoming_content, resolution),
    );
  };

  return (
    <Dialog open={path !== null} onOpenChange={(open) => !open && closeConflict()}>
      <DialogContent className="flex h-[80vh] max-w-6xl flex-col gap-3 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-ui-base">
            <Warning size={16} className="text-status-error" />
            Resolve conflict
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-ui-xs">{path}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          {loading && (
            <div className="flex flex-1 items-center justify-center gap-2 text-ui-xs text-fg-muted">
              <Spinner size={16} className="animate-spin" />
              Loading conflict…
            </div>
          )}

          {!loading && sides && sides.is_binary && (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-ui-sm text-fg-muted">
              Binary file conflict. Resolve it in the terminal, then mark it resolved.
            </div>
          )}

          {!loading && sides && !sides.is_binary && (
            <div className="min-h-0 flex-1 overflow-hidden rounded border border-border">
              <InlineDiff
                className="h-full"
                filePath={path ?? ""}
                original={showBase ? sides.base_content : sides.current_content}
                modified={sides.incoming_content}
              />
            </div>
          )}

          {!loading && sides && hunks.length > 0 && (
            <div className="max-h-44 shrink-0 overflow-y-auto rounded border border-border p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-ui-xs text-fg-subtle">
                  {hunks.length} conflict {hunks.length === 1 ? "hunk" : "hunks"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-ui-xs"
                  onClick={() => setShowBase((value) => !value)}
                >
                  {showBase ? "Hide base" : "Show base"}
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {hunks.map((hunk) => (
                  <div key={hunk.index} className="rounded border border-border/60 p-2">
                    <div className="mb-1 text-ui-xs text-fg-subtle">
                      Line {hunk.startLine}
                      {hunk.base !== null ? " · includes base" : ""}
                    </div>
                    <div className="mb-1.5 grid grid-cols-2 gap-2 text-ui-xs">
                      <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded bg-status-success/5 p-1 font-mono text-fg-default/90">
                        {hunk.current || "(empty)"}
                      </pre>
                      <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded bg-status-info/5 p-1 font-mono text-fg-default/90">
                        {hunk.incoming || "(empty)"}
                      </pre>
                    </div>
                    <div className="flex items-center gap-1">
                      {RESOLUTIONS.map((resolution) => (
                        <Button
                          key={resolution.value}
                          variant={choices[hunk.index] === resolution.value ? "default" : "outline"}
                          size="sm"
                          className={cn("h-6 px-2 text-ui-xs")}
                          onClick={() =>
                            setChoices((prev) => ({ ...prev, [hunk.index]: resolution.value }))
                          }
                        >
                          {resolution.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && sides && hunks.length === 0 && (
            <div className="shrink-0 text-ui-xs text-fg-subtle">
              {unresolvedMarkers
                ? "Conflict markers are present but could not be grouped."
                : "No conflict markers in the working file. Choose a full-file resolution or mark it resolved."}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={closeConflict}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!path || loading}
            onClick={() => path && void markConflictResolved(path)}
          >
            Mark resolved
          </Button>
          {hunks.length > 0 && (
            <Button
              variant="default"
              size="sm"
              disabled={loading || Object.keys(choices).length === 0}
              onClick={handleApplyHunks}
            >
              Apply hunk choices
            </Button>
          )}
          <div className="mx-1 h-4 w-px bg-border" />
          {RESOLUTIONS.map((resolution) => (
            <Button
              key={resolution.value}
              variant="outline"
              size="sm"
              disabled={loading || !sides || sides.is_binary}
              onClick={() => handleFileResolution(resolution.value)}
            >
              Accept {resolution.label.toLowerCase()}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
