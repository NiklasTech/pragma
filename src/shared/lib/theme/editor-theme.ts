import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import { Compartment } from "@codemirror/state";

export const themeCompartment = new Compartment();

export type EditorThemeName = "dark-default" | "one-dark";

const pragmaDarkBase = EditorView.theme({
  "&": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-fg)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter-bg)",
    borderRight: "1px solid var(--border-default)",
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
