import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import { Compartment } from "@codemirror/state";

export const themeCompartment = new Compartment();

export type EditorThemeName = "dark-default" | "one-dark";

const editorBaseSpec = {
  "&": {
    height: "100%",
    position: "relative",
  },
  ".cm-scroller": {
    overflow: "auto",
    lineHeight: "1.6",
  },
  ".cm-content": {
    padding: "8px 0",
    caretColor: "var(--editor-cursor)",
  },
  ".cm-line": {
    padding: "0 12px 0 8px",
  },
  ".cm-tooltip-autocomplete ul": {
    maxWidth: "min(560px, 70vw)",
  },
  ".cm-tooltip.cm-completionInfo": {
    maxWidth: "min(420px, 70vw)",
    maxHeight: "260px",
    overflowY: "auto",
  },
  ".cm-lsp-completion-doc": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    fontSize: "12px",
    lineHeight: "1.5",
  },
  ".cm-lsp-markdown-text": {
    margin: "2px 0",
  },
  ".cm-lsp-code-block": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: "11.5px",
    lineHeight: "1.5",
    backgroundColor: "var(--bg-hover)",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    padding: "6px 8px",
    margin: "6px 0",
    overflowX: "auto",
    whiteSpace: "pre",
  },
  ".cm-lsp-inline-code": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: "11px",
    backgroundColor: "var(--bg-hover)",
    borderRadius: "4px",
    padding: "1px 4px",
  },
  ".cm-lsp-signature-help": {
    padding: "6px 10px",
    maxWidth: "min(480px, 70vw)",
    fontSize: "12px",
    lineHeight: "1.5",
  },
  ".cm-lsp-signature-label": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  ".cm-lsp-signature-active": {
    fontWeight: "bold",
    textDecoration: "underline",
  },
  ".cm-lsp-signature-counter": {
    marginLeft: "8px",
    fontSize: "10px",
    opacity: "0.6",
  },
  ".cm-lsp-signature-doc": {
    marginTop: "4px",
    maxHeight: "200px",
    overflowY: "auto",
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  ".cm-lsp-definition-link": {
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".cm-tooltip.cm-hover": {
    maxWidth: "min(480px, 70vw)",
    maxHeight: "300px",
    overflowY: "auto",
    padding: "6px 10px",
  },
  ".cm-lsp-hover-doc": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    fontSize: "12px",
    lineHeight: "1.5",
  },
};

export const searchPanelOverlayTheme = {
  "& .cm-panels.cm-panels-top": {
    position: "absolute",
    top: "8px",
    right: "12px",
    left: "auto",
    bottom: "auto",
    zIndex: "60",
    width: "min(420px, calc(100% - 24px))",
    maxWidth: "min(420px, calc(100% - 24px))",
    height: "auto",
    overflow: "visible",
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
    pointerEvents: "none",
  },
  "& .cm-panel.cm-search": {
    position: "relative",
    margin: "0",
    padding: "0",
    pointerEvents: "auto",
  },
  "& .cm-panel.cm-search input": {
    margin: "0",
  },
  "& .cm-panel.cm-search button": {
    margin: "0",
    font: "inherit",
  },
  "& .cm-panel.cm-search label": {
    margin: "0",
    fontSize: "inherit",
    whiteSpace: "normal",
  },
  "& .cm-panel.cm-search .pragma-search-replace-toggle svg": {
    transition: "transform 120ms ease",
  },
  "& .cm-panel.cm-search .pragma-search-replace-toggle[aria-expanded=true] svg": {
    transform: "rotate(90deg)",
  },
};

export const editorBaseTheme: Extension[] = [
  EditorView.theme(editorBaseSpec),
  EditorView.theme(searchPanelOverlayTheme),
];

export function createEditorFontStyleExtension(fontSize: number, fontFamily: string): Extension {
  const family = fontFamily.trim() || 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)';
  return EditorView.theme({
    "&": {
      fontSize: `${fontSize}px`,
      fontFamily: `${family}, ui-monospace, monospace`,
    },
    ".cm-gutters": {
      fontFamily: `${family}, ui-monospace, monospace`,
      fontSize: `${fontSize}px`,
    },
  });
}

const pragmaDarkBase = EditorView.theme({
  "&": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-fg)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter-bg)",
    color: "var(--editor-gutter-fg)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-line-active)",
    color: "var(--editor-fg)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-line-active)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--editor-cursor)",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--bg-hover)",
    borderColor: "var(--border-default)",
    color: "var(--editor-fg)",
  },
  ".cm-lineNumbers": {
    color: "var(--editor-gutter-fg)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
    color: "var(--fg-default)",
  },
  ".cm-tooltip-lint": {
    backgroundColor: "var(--bg-surface)",
    color: "var(--fg-default)",
  },
  ".cm-diagnostic": {
    color: "var(--fg-default)",
  },
  ".cm-diagnostic-error": {
    borderLeft: "3px solid var(--color-status-error)",
  },
  ".cm-diagnostic-warning": {
    borderLeft: "3px solid var(--color-status-warning)",
  },
  ".cm-diagnostic-info": {
    borderLeft: "3px solid var(--color-status-info)",
  },
  ".cm-lintRange-error": {
    backgroundColor: "color-mix(in srgb, var(--color-status-error) 22%, transparent)",
    borderBottom: "2px wavy var(--color-status-error)",
  },
  ".cm-lintRange-warning": {
    backgroundColor: "color-mix(in srgb, var(--color-status-warning) 22%, transparent)",
    borderBottom: "2px wavy var(--color-status-warning)",
  },
  ".cm-lintRange-info": {
    backgroundColor: "color-mix(in srgb, var(--color-status-info) 22%, transparent)",
    borderBottom: "2px wavy var(--color-status-info)",
  },
  ".cm-lintGutter": {
    width: "20px",
  },
  ".cm-lintGutter .cm-gutterElement svg": {
    width: "12px",
    height: "12px",
  },
});

const pragmaDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: "var(--syntax-property)",
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "var(--syntax-function)",
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: "var(--syntax-number)",
  },
  { tag: [tags.definition(tags.name), tags.separator], color: "var(--editor-fg)" },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.number,
      tags.changed,
      tags.annotation,
      tags.modifier,
      tags.self,
      tags.namespace,
    ],
    color: "var(--syntax-type)",
  },
  {
    tag: [
      tags.operator,
      tags.operatorKeyword,
      tags.url,
      tags.escape,
      tags.regexp,
      tags.link,
      tags.special(tags.string),
    ],
    color: "var(--syntax-operator)",
  },
  { tag: [tags.meta, tags.comment], color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: [tags.link, tags.annotation],
    color: "var(--syntax-function)",
    textDecoration: "underline",
  },
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    color: "var(--syntax-tag)",
    fontWeight: "bold",
  },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: "var(--syntax-number)",
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted],
    color: "var(--syntax-string)",
  },
  { tag: [tags.contentSeparator], color: "var(--editor-fg)" },
  {
    tag: tags.invalid,
    color: "var(--syntax-tag)",
    borderBottom: "1px dotted var(--syntax-tag)",
  },
  { tag: tags.punctuation, color: "var(--syntax-comment)" },
  { tag: tags.tagName, color: "var(--syntax-tag)" },
  { tag: tags.attributeName, color: "var(--syntax-attribute)" },
  { tag: tags.attributeValue, color: "var(--syntax-string)" },
]);

export const pragmaDarkTheme: Extension[] = [
  pragmaDarkBase,
  syntaxHighlighting(pragmaDarkHighlight),
];

const themeRegistry: Record<EditorThemeName, Extension[]> = {
  "dark-default": pragmaDarkTheme,
  "one-dark": [oneDark],
};

export function getTheme(name: EditorThemeName): Extension[] {
  return themeRegistry[name] ?? pragmaDarkTheme;
}

export const defaultThemeName: EditorThemeName = "dark-default";
