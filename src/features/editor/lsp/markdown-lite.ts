import { highlight, isHighlightable } from "@/features/ai/components/chat-code-lezer";

export type MarkdownSegment =
  | { kind: "code"; language: string | null; code: string }
  | { kind: "text"; text: string };

export type InlineNode = { kind: "text" | "code" | "bold"; text: string };

const FENCE_PATTERN = /```([^\n`]*)\n([\s\S]*?)```/g;
const BOLD_PATTERN = /\*\*([^*]+)\*\*/g;
const INLINE_CODE_PATTERN = /`([^`]+)`/g;

export function parseMarkdownSegments(markdown: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];

  const pushText = (raw: string) => {
    const text = raw.trim();
    if (text) {
      segments.push({ kind: "text", text });
    }
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FENCE_PATTERN.lastIndex = 0;
  while ((match = FENCE_PATTERN.exec(markdown)) !== null) {
    pushText(markdown.slice(lastIndex, match.index));
    segments.push({
      kind: "code",
      language: match[1].trim() || null,
      code: match[2].replace(/\n$/, ""),
    });
    lastIndex = match.index + match[0].length;
  }
  pushText(markdown.slice(lastIndex));

  return segments.length > 0 ? segments : [{ kind: "text", text: markdown }];
}

export function parseInlineNodes(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];

  const pushTextWithCode = (raw: string) => {
    if (!raw) {
      return;
    }
    let index = 0;
    let match: RegExpExecArray | null;
    INLINE_CODE_PATTERN.lastIndex = 0;
    while ((match = INLINE_CODE_PATTERN.exec(raw)) !== null) {
      if (match.index > index) {
        nodes.push({ kind: "text", text: raw.slice(index, match.index) });
      }
      nodes.push({ kind: "code", text: match[1] });
      index = match.index + match[0].length;
    }
    if (index < raw.length) {
      nodes.push({ kind: "text", text: raw.slice(index) });
    }
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    pushTextWithCode(text.slice(lastIndex, match.index));
    const boldContent = match[1].replace(/`/g, "");
    if (boldContent) {
      nodes.push({ kind: "bold", text: boldContent });
    }
    lastIndex = match.index + match[0].length;
  }
  pushTextWithCode(text.slice(lastIndex));

  return nodes.length > 0 ? nodes : [{ kind: "text", text }];
}

export function renderMarkdownToDom(markdown: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "cm-lsp-markdown";

  for (const segment of parseMarkdownSegments(markdown)) {
    if (segment.kind === "code") {
      root.appendChild(buildCodeBlock(segment.code, segment.language));
      continue;
    }

    const paragraph = document.createElement("div");
    paragraph.className = "cm-lsp-markdown-text";
    for (const node of parseInlineNodes(segment.text)) {
      if (node.kind === "code") {
        const code = document.createElement("code");
        code.className = "cm-lsp-inline-code";
        code.textContent = node.text;
        paragraph.appendChild(code);
      } else if (node.kind === "bold") {
        const strong = document.createElement("strong");
        strong.textContent = node.text;
        paragraph.appendChild(strong);
      } else {
        paragraph.appendChild(document.createTextNode(node.text));
      }
    }
    root.appendChild(paragraph);
  }

  return root;
}

function buildCodeBlock(code: string, language: string | null): HTMLElement {
  const pre = document.createElement("pre");
  pre.className = "cm-lsp-code-block";
  const codeElement = document.createElement("code");
  codeElement.textContent = code;
  pre.appendChild(codeElement);

  if (language && isHighlightable(language)) {
    void highlight(code, language).then((nodes) => {
      if (!nodes || !pre.isConnected) {
        return;
      }
      codeElement.textContent = "";
      for (const node of nodes) {
        if (node.kind === "break") {
          codeElement.appendChild(document.createTextNode("\n"));
          continue;
        }
        const span = document.createElement("span");
        if (node.cls) {
          span.className = node.cls;
        }
        span.textContent = node.value;
        codeElement.appendChild(span);
      }
    });
  }

  return pre;
}
