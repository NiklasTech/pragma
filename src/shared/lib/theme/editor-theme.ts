import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import { Compartment } from "@codemirror/state";

export const themeCompartment = new Compartment();

export type EditorThemeName = "pragma-dark" | "one-dark";

const pragmaDarkBase = EditorView.theme({
  "&": {
    backgroundColor: "var(--color-editor-bg)",
    color: "var(--color-editor-fg)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-editor-gutter-bg)",
    borderRight: "1px solid var(--color-border-default)",
    color: "var(--color-editor-gutter-fg)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-editor-line-active)",
    color: "var(--color-editor-fg)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--color-editor-line-active)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--color-editor-selection)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-editor-cursor)",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-bg-hover)",
    borderColor: "var(--color-border-default)",
    color: "var(--color-editor-fg)",
  },
  ".cm-lineNumbers": {
    color: "var(--color-editor-gutter-fg)",
  },
});

const pragmaDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--color-syntax-keyword)" },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: "var(--color-syntax-property)",
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "var(--color-syntax-function)",
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: "var(--color-syntax-number)",
  },
  { tag: [tags.definition(tags.name), tags.separator], color: "var(--color-editor-fg)" },
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
    color: "var(--color-syntax-type)",
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
    color: "var(--color-syntax-operator)",
  },
  { tag: [tags.meta, tags.comment], color: "var(--color-syntax-comment)", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: [tags.link, tags.annotation],
    color: "var(--color-syntax-function)",
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
    color: "var(--color-syntax-tag)",
    fontWeight: "bold",
  },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: "var(--color-syntax-number)",
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted],
    color: "var(--color-syntax-string)",
  },
  { tag: [tags.contentSeparator], color: "var(--color-editor-fg)" },
  {
    tag: tags.invalid,
    color: "var(--color-syntax-tag)",
    borderBottom: "1px dotted var(--color-syntax-tag)",
  },
  { tag: tags.punctuation, color: "var(--color-syntax-comment)" },
  { tag: tags.tagName, color: "var(--color-syntax-tag)" },
  { tag: tags.attributeName, color: "var(--color-syntax-attribute)" },
  { tag: tags.attributeValue, color: "var(--color-syntax-string)" },
]);

export const pragmaDarkTheme: Extension[] = [
  pragmaDarkBase,
  syntaxHighlighting(pragmaDarkHighlight),
];

const themeRegistry: Record<EditorThemeName, Extension[]> = {
  "pragma-dark": pragmaDarkTheme,
  "one-dark": [oneDark],
};

export function getTheme(name: EditorThemeName): Extension[] {
  return themeRegistry[name] ?? pragmaDarkTheme;
}

export const defaultThemeName: EditorThemeName = "pragma-dark";
