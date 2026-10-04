import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowCounterClockwise, Minus, Plus } from "@phosphor-icons/react";
import type { GitLineAction, GitLineSelection } from "@/shared/stores/git";
import {
  lineSelection,
  parsePatchHunks,
  patchLineKey,
  type PatchHunk,
  type PatchLine,
} from "@/shared/lib/diffHunks";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

interface GitHunkDiffViewProps {
  patchText: string;
  staged: boolean;
  busy: boolean;
  onApply: (action: GitLineAction, selection: GitLineSelection) => void;
}

type Row =
  | { kind: "hunk"; hunkIndex: number }
  | { kind: "line"; hunkIndex: number; lineIndex: number; line: PatchLine };

const LINE_CLASSES: Record<PatchLine["type"], string> = {
  added: "bg-status-success/5 text-status-success/90",
  removed: "bg-status-error/5 text-status-error/90",
  context: "text-fg-default/80",
};

const PREFIX: Record<PatchLine["type"], string> = { added: "+", removed: "-", context: " " };

/** Unified diff with stage, unstage and discard actions per hunk and per selected lines. */
export const GitHunkDiffView = memo(function GitHunkDiffView({
  patchText,
  staged,
  busy,
  onApply,
}: GitHunkDiffViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hunks = useMemo(() => parsePatchHunks(patchText), [patchText]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<{ hunkIndex: number; lineIndex: number } | null>(null);

  useEffect(() => {
    setSelected(new Set());
    setAnchor(null);
  }, [patchText]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    hunks.forEach((hunk, hunkIndex) => {
      out.push({ kind: "hunk", hunkIndex });
      hunk.lines.forEach((line, lineIndex) =>
        out.push({ kind: "line", hunkIndex, lineIndex, line }),
      );
    });
    return out;
  }, [hunks]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index]?.kind === "hunk" ? 28 : 20),
    overscan: 20,
    getItemKey: (index) => {
      const row = rows[index];
      if (!row) return index;
      return row.kind === "hunk" ? `h${row.hunkIndex}` : `l${row.hunkIndex}:${row.lineIndex}`;
    },
  });

  const toggleLine = (event: MouseEvent, hunkIndex: number, lineIndex: number) => {
    const hunk = hunks[hunkIndex];
    const line = hunk?.lines[lineIndex];
    if (!hunk || !line || line.type === "context") return;

    const next = new Set(selected);
    if (event.shiftKey && anchor && anchor.hunkIndex === hunkIndex) {
      const [from, to] = [anchor.lineIndex, lineIndex].sort((a, b) => a - b);
      for (const ranged of hunk.lines.slice(from, (to ?? from) + 1)) {
        if (ranged.type !== "context") next.add(patchLineKey(ranged));
      }
    } else {
      const key = patchLineKey(line);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setAnchor({ hunkIndex, lineIndex });
    }
    setSelected(next);
  };

  const applyToHunk = (hunk: PatchHunk, action: GitLineAction) => {
    const chosen = hunk.lines.filter(
      (line) => line.type !== "context" && selected.has(patchLineKey(line)),
    );
    onApply(action, lineSelection(chosen.length > 0 ? chosen : hunk.lines));
  };

  if (hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ui-sm text-fg-muted">
        No changes
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full w-full overflow-auto font-mono text-ui-base">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          const style = {
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: "100%",
            height: item.size,
            transform: `translateY(${item.start}px)`,
          };

          if (row.kind === "hunk") {
            const hunk = hunks[row.hunkIndex];
            if (!hunk) return null;
            const count = hunk.lines.filter(
              (line) => line.type !== "context" && selected.has(patchLineKey(line)),
            ).length;
            const scope = count > 0 ? `${count} ${count === 1 ? "line" : "lines"}` : "hunk";
            return (
              <div
                key={item.key}
                style={style}
                className="flex items-center gap-2 border-y border-border/60 bg-status-info/5 px-2"
              >
                <span className="min-w-0 flex-1 truncate text-ui-xs text-status-info/70">
                  {hunk.header}
                </span>
                {staged ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="font-sans text-ui-xs"
                    disabled={busy}
                    onClick={() => applyToHunk(hunk, "unstage")}
                  >
                    <Minus size={12} />
                    Unstage {scope}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="font-sans text-ui-xs hover:text-status-error"
                      disabled={busy}
                      onClick={() => applyToHunk(hunk, "discard")}
                    >
                      <ArrowCounterClockwise size={12} />
                      Discard {scope}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="font-sans text-ui-xs"
                      disabled={busy}
                      onClick={() => applyToHunk(hunk, "stage")}
                    >
                      <Plus size={12} />
                      Stage {scope}
                    </Button>
                  </>
                )}
              </div>
            );
          }

          const { line } = row;
          const changed = line.type !== "context";
          const isSelected = changed && selected.has(patchLineKey(line));
          return (
            <div
              key={item.key}
              style={style}
              role={changed ? "checkbox" : undefined}
              aria-checked={changed ? isSelected : undefined}
              title={changed ? "Click to select, Shift+click to select a range" : undefined}
              onClick={(event) => toggleLine(event, row.hunkIndex, row.lineIndex)}
              className={cn(
                "flex items-start",
                LINE_CLASSES[line.type],
                changed && "cursor-pointer",
                isSelected && "bg-primary/15",
              )}
            >
              <span className="w-10 shrink-0 select-none pr-1 text-right text-ui-xs leading-5 text-fg-muted/50">
                {line.oldLine ?? ""}
              </span>
              <span className="w-10 shrink-0 select-none pr-1 text-right text-ui-xs leading-5 text-fg-muted/50">
                {line.newLine ?? ""}
              </span>
              <span
                className={cn(
                  "w-5 shrink-0 select-none text-center text-ui-xs leading-5",
                  isSelected && "bg-primary/40 text-fg-default",
                )}
              >
                {PREFIX[line.type]}
              </span>
              <span className="min-w-0 flex-1 truncate whitespace-pre px-1 leading-5">
                {line.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
