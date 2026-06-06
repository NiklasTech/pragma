import { useEffect, useRef, useState } from "react";
import { syntaxTree, ensureSyntaxTree } from "@codemirror/language";
import { type SyntaxNode } from "@lezer/common";
import { type EditorView } from "@codemirror/view";

interface StickyLinesOverlayProps {
  view: EditorView | null;
  enabled: boolean;
}

const blockTypes = new Set([
  "Block",
  "StatementBlock",
  "ClassBody",
  "FunctionBody",
  "InterfaceBody",
  "EnumBody",
  "ObjectExpression",
  "ArrayExpression",
  "IfStatement",
  "WhileStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "SwitchStatement",
  "TryStatement",
  "WithStatement",
  "FunctionDefinition",
  "FunctionDeclaration",
  "MethodDefinition",
  "ClassDeclaration",
  "ClassDefinition",
  "ClassExpression",
  "InterfaceDeclaration",
  "TypeAliasDeclaration",
  "EnumDeclaration",
  "StructDeclaration",
  "Trait",
  "ImplBlock",
  "Module",
  "NamespaceDeclaration",
  "PropertyDeclaration",
  "FieldDeclaration",
  "ArrowFunction",
  "LambdaExpression",
]);

function getContextLine(view: EditorView, line: number): { text: string; line: number } | null {
  const pos = view.state.doc.line(Math.min(line, view.state.doc.lines)).from;
  ensureSyntaxTree(view.state, pos, 50);
  const tree = syntaxTree(view.state);
  if (tree.length === 0) return null;

  let node: SyntaxNode | null = tree.resolveInner(pos, -1);

  while (node) {
    if (blockTypes.has(node.type.name)) {
      const startLine = view.state.doc.lineAt(node.from).number;
      if (startLine < line) {
        const text = view.state.doc.lineAt(node.from).text.trim();
        if (text) {
          return { text, line: startLine };
        }
      }
    }
    node = node.parent;
  }

  return null;
}

export function StickyLinesOverlay({ view, enabled }: StickyLinesOverlayProps) {
  const [context, setContext] = useState<{ text: string; line: number } | null>(null);
  const [gutterWidth, setGutterWidth] = useState(40);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!view || !enabled) {
      setContext(null);
      return;
    }

    const scroller = view.scrollDOM;

    const update = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const startLine = view.state.doc.lineAt(view.viewport.from).number;
        const ctx = getContextLine(view, startLine);
        setContext(ctx);

        const gutter = view.dom.querySelector(".cm-gutters") as HTMLElement | null;
        if (gutter) {
          setGutterWidth(gutter.offsetWidth);
        }
      });
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", update);
      cancelAnimationFrame(rafRef.current);
    };
  }, [view, enabled]);

  if (!enabled || !context) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-50 pointer-events-none overflow-hidden"
      style={{ paddingLeft: gutterWidth }}
    >
      <div
        className="pointer-events-auto truncate px-3 py-1 text-sm border-b opacity-95"
        style={{
          backgroundColor: "var(--editor-background, #1a1b26)",
          borderColor: "var(--border, #2a2b36)",
          color: "var(--editor-foreground, #c0caf5)",
          fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
          lineHeight: 1.6,
        }}
      >
        {context.text}
      </div>
    </div>
  );
}
