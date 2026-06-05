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
    backgroundColor: "var(--editor-background)",
    color: "var(--editor-foreground)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    borderRight: "1px solid var(--border)",
    color: "var(--editor-gutter-foreground)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-line)",
    color: "var(--editor-foreground)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--editor-cursor)",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--secondary)",
    borderColor: "var(--border)",
    color: "var(--editor-foreground)",
  },
  ".cm-lineNumbers": {
    color: "var(--editor-gutter-foreground)",
  },
});

const pragmaDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--editor-keyword)" },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
    color: "var(--editor-property)",
  },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "var(--editor-function)" },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: "var(--editor-number)",
  },
  { tag: [tags.definition(tags.name), tags.separator], color: "var(--editor-foreground)" },
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
    color: "var(--editor-type)",
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
    color: "var(--editor-operator)",
  },
  { tag: [tags.meta, tags.comment], color: "var(--editor-comment)", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: [tags.link, tags.annotation],
    color: "var(--editor-function)",
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
    color: "var(--editor-tag)",
    fontWeight: "bold",
  },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "var(--editor-number)" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "var(--editor-string)" },
  { tag: [tags.contentSeparator], color: "var(--editor-foreground)" },
  { tag: tags.invalid, color: "var(--editor-tag)", borderBottom: "1px dotted var(--editor-tag)" },
  { tag: tags.punctuation, color: "var(--editor-comment)" },
  { tag: tags.tagName, color: "var(--editor-tag)" },
  { tag: tags.attributeName, color: "var(--editor-attribute)" },
  { tag: tags.attributeValue, color: "var(--editor-string)" },
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
