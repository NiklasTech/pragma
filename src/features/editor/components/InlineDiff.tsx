import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Spinner, Columns, Rows, Check, X } from "@phosphor-icons/react";
import { pragmaDarkTheme, themeCompartment } from "@/shared/lib/theme/editor-theme";
import { loadLanguage } from "@/shared/lib/editor/languages";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

const languageCompartment = new Compartment();

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
    backgroundColor: "transparent",
    color: "var(--muted-foreground, #9ca3af)",
    fontSize: "10.5px",
    padding: "2px 8px",
    opacity: 0.7,
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

function SplitDiffView({
  original,
  modified,
  filePath,
}: {
  original: string;
  modified: string;
  filePath: string;
}) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const extensions = useMemo(
    () => [
      languageCompartment.of([]),
      themeCompartment.of(pragmaDarkTheme),
      ...READONLY_EXT,
      unifiedMergeView({
        original,
        mergeControls: false,
        highlightChanges: true,
        gutter: true,
        syntaxHighlightDeletions: true,
        collapseUnchanged: { margin: 3, minSize: 6 },
      }),
      DIFF_THEME,
    ],
    [original],
  );

  useEffect(() => {
    let cancelled = false;
    loadLanguage(filePath)
      .then((ext) => {
        if (cancelled) return;
        const view = cmRef.current?.view;
        if (!view) return;
        view.dispatch({
          effects: languageCompartment.reconfigure(ext),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <CodeMirror
        ref={cmRef}
        value={modified}
        theme="dark"
        extensions={extensions}
        editable={false}
        height="100%"
        className="h-full text-ui-base"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  );
}

type DiffLineType = "added" | "removed" | "hunk" | "context" | "header";

interface DiffLine {
  type: DiffLineType;
  content: string;
  raw: string;
}

function parseDiffLines(patchText: string): DiffLine[] {
  const lines = patchText.split("\n");
  const result: DiffLine[] = [];

  for (const raw of lines) {
    if (raw.startsWith("@@")) {
      result.push({ type: "hunk", content: raw, raw });
    } else if (raw.startsWith("+")) {
      result.push({ type: "added", content: raw.slice(1), raw });
    } else if (raw.startsWith("-")) {
      result.push({ type: "removed", content: raw.slice(1), raw });
    } else if (raw.startsWith("---") || raw.startsWith("+++")) {
      result.push({ type: "header", content: raw, raw });
    } else {
      result.push({ type: "context", content: raw, raw });
    }
  }

  return result;
}

function UnifiedDiffView({ patchText }: { patchText: string }) {
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
      case "header":
        return "text-fg-muted/60";
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
      case "header":
        return "";
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
}

export function InlineDiff({
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
              "h-6 px-2 text-ui-xs gap-1",
              effectiveViewMode === "split" && "bg-bg-active text-fg-default",
            )}
            onClick={() => handleViewModeChange("split")}
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
      <div className="min-h-0 flex-1 overflow-hidden" style={{ maxWidth: "100%" }}>
        {effectiveViewMode === "split" ? (
          <SplitDiffView original={original} modified={modified} filePath={filePath} />
        ) : canShowUnified ? (
          <UnifiedDiffView patchText={patchText} />
        ) : (
          <SplitDiffView original={original} modified={modified} filePath={filePath} />
        )}
      </div>
    </div>
  );
}
