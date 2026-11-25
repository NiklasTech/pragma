import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Spinner, Columns, Rows, Check, X } from "@phosphor-icons/react";
import { pragmaDarkTheme, editorBaseTheme } from "@/shared/lib/theme/editor-theme";
import { useTheme } from "@/theme";
import { loadLanguage } from "@/shared/lib/editor/languages";
import { DiffGutter } from "@/shared/components/DiffGutter";
import {
  hunkPlace,
  hunkSection,
  lineNumberDigits,
  longestLine,
  parsePatchHunks,
  type PatchHunk,
  type PatchLine,
} from "@/shared/lib/diffHunks";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

const READONLY_EXT = [EditorState.readOnly.of(true), EditorView.editable.of(false)];

const DIFF_THEME = EditorView.theme({
  "&.cm-merge-b .cm-changedText, .cm-changedText": {
    background: "rgba(110, 200, 120, 0.20) !important",
    borderRadius: "3px",
    padding: "0 1px",
  },
  ".cm-deletedChunk .cm-deletedText, &.cm-merge-b .cm-deletedText": {
    background: "rgba(220, 90, 90, 0.22) !important",
    borderRadius: "3px",
    padding: "0 1px",
  },
  "&.cm-merge-b .cm-changedLine, .cm-changedLine, .cm-inlineChangedLine": {
    backgroundColor: "rgba(110, 200, 120, 0.05) !important",
  },
  ".cm-deletedChunk": {
    backgroundColor: "rgba(220, 90, 90, 0.05) !important",
    paddingTop: "1px",
    paddingBottom: "1px",
  },
  "&.cm-merge-b .cm-changedLineGutter, .cm-changedLineGutter": {
    background: "rgba(110, 200, 120, 0.55) !important",
  },
  ".cm-deletedLineGutter, &.cm-merge-a .cm-changedLineGutter": {
    background: "rgba(220, 90, 90, 0.5) !important",
  },
  ".cm-changeGutter": {
    width: "2px !important",
    paddingLeft: "0 !important",
  },
  ".cm-collapsedLines": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: "100%",
    background: "var(--bg-hover) !important",
    color: "var(--fg-muted) !important",
    fontSize: "10.5px",
    padding: "2px 8px !important",
    borderTop: "1px solid var(--border-default)",
    borderBottom: "1px solid var(--border-default)",
    cursor: "pointer",
    transition: "background-color 0.15s ease, color 0.15s ease",
  },
  ".cm-collapsedLines::before, .cm-collapsedLines::after": {
    content: "none !important",
  },
  ".cm-collapsedLines:hover": {
    background: "var(--bg-active) !important",
    color: "var(--fg-default) !important",
  },
});

export type DiffViewMode = "split" | "unified";

interface InlineDiffProps {
  original: string;
  modified: string;
  patchText?: string;
  filePath: string;
  viewMode?: DiffViewMode;
  onViewModeChange?: (mode: DiffViewMode) => void;
  onAccept?: (modified: string) => void;
  onReject?: () => void;
  className?: string;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded" }
  | { kind: "error"; message: string };

export const SplitDiffView = memo(function SplitDiffView({
  original,
  modified,
  filePath,
  theme,
}: {
  original: string;
  modified: string;
  filePath: string;
  theme: "light" | "dark";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const aLangCompartment = useRef(new Compartment());
  const bLangCompartment = useRef(new Compartment());

  const createExtensions = useCallback(
    (langCompartment: Compartment) => [
      langCompartment.of([]),
      EditorView.theme({}, { dark: theme === "dark" }),
      pragmaDarkTheme,
      editorBaseTheme,
      ...READONLY_EXT,
      lineNumbers(),
      DIFF_THEME,
    ],
    [theme],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const mv = new MergeView({
      a: {
        doc: original,
        extensions: createExtensions(aLangCompartment.current),
      },
      b: {
        doc: modified,
        extensions: createExtensions(bLangCompartment.current),
      },
      parent: containerRef.current,
      orientation: "a-b",
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 6 },
    });
    mergeViewRef.current = mv;

    return () => {
      mv.destroy();
      mergeViewRef.current = null;
    };
  }, [original, modified, createExtensions]);

  useEffect(() => {
    let cancelled = false;
    loadLanguage(filePath)
      .then((ext) => {
        if (cancelled) return;
        const mv = mergeViewRef.current;
        if (!mv) return;
        mv.a.dispatch({ effects: aLangCompartment.current.reconfigure(ext) });
        mv.b.dispatch({ effects: bLangCompartment.current.reconfigure(ext) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Both sides fill the panel, so their scrollbars and the divider reach its bottom.
  return (
    <div
      ref={containerRef}
      className="h-full w-full [&_.cm-mergeView]:h-full [&_.cm-mergeViewEditor]:flex [&_.cm-mergeViewEditor]:flex-col [&_.cm-mergeViewEditor_.cm-editor]:flex-[1_0_auto] [&_.cm-mergeViewEditor_.cm-scroller]:flex-[1_0_auto] [&_.cm-mergeViewEditor_.cm-scroller]:items-stretch! [&_.cm-mergeViewEditors]:min-h-full"
    />
  );
});

type UnifiedRow = { kind: "hunk"; hunk: PatchHunk } | { kind: "line"; line: PatchLine };

const LINE_CLASSES: Record<PatchLine["type"], string> = {
  added: "bg-status-success/5 text-status-success",
  removed: "bg-status-error/5 text-status-error",
  context: "text-fg-default/80",
};

const SIGNS: Record<PatchLine["type"], string> = { added: "+", removed: "-", context: " " };

const UnifiedDiffView = memo(function UnifiedDiffView({ patchText }: { patchText: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hunks = useMemo(() => parsePatchHunks(patchText), [patchText]);
  const digits = useMemo(() => lineNumberDigits(hunks), [hunks]);
  const longest = useMemo(() => longestLine(hunks), [hunks]);
  const rows = useMemo<UnifiedRow[]>(
    () =>
      hunks.flatMap((hunk): UnifiedRow[] => [
        { kind: "hunk", hunk },
        ...hunk.lines.map((line): UnifiedRow => ({ kind: "line", line })),
      ]),
    [hunks],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 20,
    overscan: 20,
  });

  return (
    <div ref={scrollRef} className="h-full w-full overflow-auto font-mono text-ui-base">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          minWidth: `calc(${longest + 2 * digits + 4}ch + 48px)`,
          tabSize: 4,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (!row) return null;
          const style = {
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: "100%",
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`,
          };
          if (row.kind === "hunk") {
            return (
              <div
                key={virtualItem.key}
                style={style}
                className="flex items-center bg-status-info/5 px-2 text-ui-xs text-status-info"
              >
                <span className="sticky left-2 truncate" title={row.hunk.header}>
                  {hunkPlace(row.hunk)}
                  <span className="ml-2 text-fg-subtle">{hunkSection(row.hunk.header)}</span>
                </span>
              </div>
            );
          }
          const { line } = row;
          return (
            <div
              key={virtualItem.key}
              style={style}
              className={cn("flex items-start", LINE_CLASSES[line.type])}
            >
              <DiffGutter line={line} digits={digits} />
              <span className="w-5 shrink-0 text-center leading-5 select-none">
                {SIGNS[line.type]}
              </span>
              <span className="flex-1 px-1 leading-5 whitespace-pre">{line.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const InlineDiff = memo(function InlineDiff({
  original,
  modified,
  patchText,
  filePath,
  viewMode = "split",
  onViewModeChange,
  onAccept,
  onReject,
  className,
}: InlineDiffProps) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [internalViewMode, setInternalViewMode] = useState<DiffViewMode>(viewMode);
  const rootRef = useRef<HTMLDivElement>(null);

  const { editorMode } = useTheme();
  const effectiveViewMode = onViewModeChange ? viewMode : internalViewMode;

  useEffect(() => {
    setState({ kind: "loading" });
    const timer = setTimeout(() => {
      setState({ kind: "loaded" });
    }, 50);
    return () => clearTimeout(timer);
  }, [original, modified, patchText]);

  useEffect(() => {
    if (!onAccept && !onReject) return;

    const handler = (e: KeyboardEvent) => {
      // A diff in the hidden side of the window takes no keys.
      if (!rootRef.current?.checkVisibility()) return;
      if (onAccept && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onAccept(modified);
        return;
      }
      if (onReject && e.key === "Escape") {
        e.preventDefault();
        onReject();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAccept, onReject, modified]);

  const handleViewModeChange = (mode: DiffViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  const canShowUnified = !!patchText;
  const canShowSplit = original.length > 0 && modified.length > 0;

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
    <div ref={rootRef} className={cn("flex h-full min-h-0 flex-col min-w-0", className)}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3">
        <span className="truncate font-mono text-ui-xs text-fg-muted" title={filePath}>
          {filePath}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-ui-xs gap-1",
              effectiveViewMode === "split" && canShowSplit && "bg-bg-active text-fg-default",
              !canShowSplit && "opacity-40 cursor-not-allowed",
            )}
            onClick={() => canShowSplit && handleViewModeChange("split")}
            disabled={!canShowSplit}
          >
            <Columns size={12} />
            Split
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-ui-xs gap-1",
              effectiveViewMode === "unified" && "bg-bg-active text-fg-default",
              !canShowUnified && "opacity-40 cursor-not-allowed",
            )}
            onClick={() => canShowUnified && handleViewModeChange("unified")}
            disabled={!canShowUnified}
          >
            <Rows size={12} />
            Unified
          </Button>
          {onReject && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-ui-xs gap-1 text-status-error hover:text-status-error hover:bg-status-error/10"
              onClick={onReject}
            >
              <X size={12} weight="bold" />
              Reject
            </Button>
          )}
          {onAccept && (
            <Button
              variant="default"
              size="sm"
              className="h-6 px-2 text-ui-xs gap-1"
              onClick={() => onAccept(modified)}
            >
              <Check size={12} weight="bold" />
              Accept
            </Button>
          )}
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          effectiveViewMode === "split" && canShowSplit ? "overflow-auto" : "overflow-hidden",
        )}
        style={{ maxWidth: "100%" }}
      >
        {effectiveViewMode === "split" && canShowSplit ? (
          <SplitDiffView
            original={original}
            modified={modified}
            filePath={filePath}
            theme={editorMode}
          />
        ) : canShowUnified ? (
          <UnifiedDiffView patchText={patchText} />
        ) : (
          <SplitDiffView
            original={original}
            modified={modified}
            filePath={filePath}
            theme={editorMode}
          />
        )}
      </div>
    </div>
  );
});
