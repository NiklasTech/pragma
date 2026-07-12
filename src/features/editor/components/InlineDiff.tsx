import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Spinner, Columns, Rows, Check, X } from "@phosphor-icons/react";
import { pragmaDarkTheme, editorBaseTheme } from "@/shared/lib/theme/editor-theme";
import { useTheme } from "@/theme";
import { loadLanguage } from "@/shared/lib/editor/languages";
import { parseDiffLines, type DiffLineType } from "@/shared/lib/diff";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

const READONLY_EXT = [EditorState.readOnly.of(true), EditorView.editable.of(false)];

const DIFF_THEME = EditorView.theme({
  "&.cm-merge-b .cm-changedText, .cm-changedText": {
    background: "color-mix(in srgb, var(--color-git-added) 20%, transparent) !important",
    borderRadius: "var(--radius-xs)",
    padding: "0 1px",
  },
  ".cm-deletedChunk .cm-deletedText, &.cm-merge-b .cm-deletedText": {
    background: "color-mix(in srgb, var(--color-git-deleted) 22%, transparent) !important",
    borderRadius: "var(--radius-xs)",
    padding: "0 1px",
  },
  "&.cm-merge-b .cm-changedLine, .cm-changedLine, .cm-inlineChangedLine": {
    backgroundColor: "color-mix(in srgb, var(--color-git-added) 5%, transparent) !important",
  },
  ".cm-deletedChunk": {
    backgroundColor: "color-mix(in srgb, var(--color-git-deleted) 5%, transparent) !important",
    paddingTop: "1px",
    paddingBottom: "1px",
  },
  "&.cm-merge-b .cm-changedLineGutter, .cm-changedLineGutter": {
    background: "color-mix(in srgb, var(--color-git-added) 55%, transparent) !important",
  },
  ".cm-deletedLineGutter, &.cm-merge-a .cm-changedLineGutter": {
    background: "color-mix(in srgb, var(--color-git-deleted) 50%, transparent) !important",
  },
  ".cm-changeGutter": {
    width: "2px !important",
    paddingLeft: "0 !important",
  },
  ".cm-collapsedLines": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "var(--bg-hover) !important",
    color: "var(--fg-default) !important",
    fontSize: "var(--text-ui-2xs)",
    padding: "2px 8px",
    opacity: 1,
    borderRadius: "var(--radius-xs)",
    border: "1px solid var(--border-default)",
    cursor: "pointer",
    transition:
      "background-color var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease)",
  },
  ".cm-collapsedLines::before": {
    content: "'▾ '",
    marginRight: "4px",
    fontSize: "var(--text-ui-2xs)",
  },
  ".cm-collapsedLines:hover": {
    backgroundColor: "var(--bg-active) !important",
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

const MERGE_VIEW_THEME = EditorView.theme({
  "&.cm-mergeView": {
    minHeight: "100%",
  },
});

const SplitDiffView = memo(function SplitDiffView({
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
      DIFF_THEME,
      MERGE_VIEW_THEME,
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

  return <div ref={containerRef} className="h-full w-full" />;
});

const UnifiedDiffView = memo(function UnifiedDiffView({ patchText }: { patchText: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => parseDiffLines(patchText), [patchText]);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 20,
    overscan: 20,
  });

  const getLineClasses = useCallback((type: DiffLineType) => {
    switch (type) {
      case "added":
        return "bg-status-success/5 text-status-success/90";
      case "removed":
        return "bg-status-error/5 text-status-error/90";
      case "hunk":
        return "bg-status-info/5 text-status-info/70";

      default:
        return "text-fg-default/80";
    }
  }, []);

  const getGutterClasses = useCallback((type: DiffLineType) => {
    switch (type) {
      case "added":
        return "bg-status-success/15 text-status-success/80";
      case "removed":
        return "bg-status-error/15 text-status-error/80";
      case "hunk":
        return "bg-status-info/10 text-status-info/60";
      default:
        return "text-fg-muted/30";
    }
  }, []);

  const getPrefix = useCallback((type: DiffLineType) => {
    switch (type) {
      case "added":
        return "+";
      case "removed":
        return "-";
      case "hunk":
        return "@";
      default:
        return " ";
    }
  }, []);

  return (
    <div ref={scrollRef} className="h-full w-full overflow-auto font-mono text-ui-base">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const line = lines[virtualItem.index];
          if (!line) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className={cn("flex items-start", getLineClasses(line.type))}
            >
              <span
                className={cn(
                  "shrink-0 w-6 text-center text-ui-xs select-none leading-5",
                  getGutterClasses(line.type),
                )}
              >
                {getPrefix(line.type)}
              </span>
              <span className="min-w-0 flex-1 truncate leading-5 px-1">{line.content}</span>
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

  const { resolvedMode } = useTheme();
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
    <div className={cn("flex h-full min-h-0 flex-col min-w-0", className)}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3">
        <span className="truncate font-mono text-ui-xs text-fg-muted" title={filePath}>
          {filePath}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 gap-1 px-2 text-ui-xs transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              effectiveViewMode === "split" && canShowSplit && "bg-bg-active text-fg-default",
              !canShowSplit && "cursor-not-allowed opacity-40",
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
              "h-6 gap-1 px-2 text-ui-xs transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)]",
              effectiveViewMode === "unified" && "bg-bg-active text-fg-default",
              !canShowUnified && "cursor-not-allowed opacity-40",
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
              className="h-6 gap-1 px-2 text-ui-xs text-status-error transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[var(--color-status-error-bg)] hover:text-status-error"
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
              className="h-6 gap-1 px-2 text-ui-xs transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)]"
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
            theme={resolvedMode}
          />
        ) : canShowUnified ? (
          <UnifiedDiffView patchText={patchText} />
        ) : (
          <SplitDiffView
            original={original}
            modified={modified}
            filePath={filePath}
            theme={resolvedMode}
          />
        )}
      </div>
    </div>
  );
});
