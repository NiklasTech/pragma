import { useEffect, useMemo, useRef, useState } from "react";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Spinner } from "@phosphor-icons/react";
import { pragmaDarkTheme, themeCompartment } from "@/lib/theme/editor-theme";
import { loadLanguage } from "@/lib/editor/languages";

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
    } else if (line.startsWith("@@")) {
      // Skip hunk headers
    } else if (line.startsWith("---") || line.startsWith("+++")) {
      // Skip file headers
    } else if (line.trim()) {
      originalLines.push(line);
      modifiedLines.push(line);
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
}: {
  diffText: string;
  filePath: string;
  active: boolean;
}) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    if (!active || !diffText) return;
    setState({ kind: "loading" });
    const parsed = parseDiff(diffText);
    setState({ kind: "loaded", original: parsed.original, modified: parsed.modified });
  }, [active, diffText]);

  const loaded = state.kind === "loaded" ? state : null;
  const originalContent = loaded?.original ?? "";
  const modifiedContent = loaded?.modified ?? "";

  const initialLang = useMemo(() => {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "rs":
        return "rust";
      case "py":
        return "python";
      case "go":
        return "go";
      case "html":
        return "html";
      case "css":
        return "css";
      case "json":
        return "json";
      default:
        return "";
    }
  }, [filePath]);

  const extensions = useMemo(
    () => [
      languageCompartment.of([]),
      themeCompartment.of(pragmaDarkTheme),
      ...READONLY_EXT,
      unifiedMergeView({
        original: originalContent,
        mergeControls: false,
        highlightChanges: true,
        gutter: true,
        syntaxHighlightDeletions: true,
        collapseUnchanged: { margin: 3, minSize: 6 },
      }),
      DIFF_THEME,
    ],
    [originalContent],
  );

  useEffect(() => {
    if (!initialLang || !loaded) return;
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
  }, [initialLang, filePath, loaded]);

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <span className="truncate font-mono text-[11px] text-muted-foreground" title={filePath}>
          {filePath}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          ref={cmRef}
          value={modifiedContent}
          theme="dark"
          extensions={extensions}
          editable={false}
          height="100%"
          className="h-full text-[13px]"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
        />
      </div>
    </div>
  );
}
