import { useEffect, useState } from "react";
import { Spinner } from "@phosphor-icons/react";
import { InlineDiff, type DiffViewMode } from "@/features/editor/components/InlineDiff";
import { parseDiffToSides } from "@/shared/lib/diff";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; original: string; modified: string }
  | { kind: "error"; message: string };

export function GitDiffPane({
  diffText,
  filePath,
  active,
  viewMode,
  onViewModeChange,
}: {
  diffText: string;
  filePath: string;
  active: boolean;
  viewMode?: DiffViewMode;
  onViewModeChange?: (mode: DiffViewMode) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    if (!active || !diffText) return;
    setState({ kind: "loading" });
    const parsed = parseDiffToSides(diffText);
    setState({ kind: "loaded", original: parsed.original, modified: parsed.modified });
  }, [active, diffText]);

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-ui-xs text-fg-muted">
        <Spinner size={14} className="animate-spin" />
        Loading diff…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-ui-sm text-status-error">
        {state.message}
      </div>
    );
  }

  return (
    <InlineDiff
      original={state.original}
      modified={state.modified}
      patchText={diffText}
      filePath={filePath}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      className="h-full"
    />
  );
}
