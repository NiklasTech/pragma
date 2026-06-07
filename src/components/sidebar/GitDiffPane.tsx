import { useEffect, useState } from "react";
import { Spinner } from "@phosphor-icons/react";
import { InlineDiff, type DiffViewMode } from "@/components/editor/InlineDiff";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; original: string; modified: string }
  | { kind: "error"; message: string };

function parseDiff(diffText: string): { original: string; modified: string } {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  for (const line of diffText.split("\n")) {
    if (line.startsWith("+")) {
      modifiedLines.push(line.slice(1));
    } else if (line.startsWith("-")) {
      originalLines.push(line.slice(1));
    } else if (line.startsWith(" ")) {
      const content = line.slice(1);
      originalLines.push(content);
      modifiedLines.push(content);
    }
  }

  return {
    original: originalLines.join("\n"),
    modified: modifiedLines.join("\n"),
  };
}

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
    const parsed = parseDiff(diffText);
    setState({ kind: "loaded", original: parsed.original, modified: parsed.modified });
  }, [active, diffText]);

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Spinner size={14} className="animate-spin" />
        Loading diff…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[11.5px] text-destructive">
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
