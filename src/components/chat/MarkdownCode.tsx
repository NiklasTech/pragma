"use client";

import type { ReactNode } from "react";

import { ChatCodeBlock } from "./ChatCodeBlock";

/**
 * Streamdown/ReactMarkdown `code` override. Handles inline code and fenced
 * blocks (className "language-X"). Multi-line untagged code is also rendered
 * as a block so raw file dumps don't become unreadable text walls.
 */
export function MarkdownCode({
  className,
  children,
  ...rest
}: {
  className?: string;
  children?: ReactNode;
}) {
  // ReactMarkdown/Streamdown passes code content as a string; coerce defensively.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const value = String(children ?? "").replace(/\n$/, "");
  const match = className?.match(/language-([\w+-.]+)/);

  if (match || value.includes("\n")) {
    return <ChatCodeBlock code={value} lang={match?.[1] ?? null} />;
  }

  return (
    <code
      className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
      {...rest}
    >
      {children}
    </code>
  );
}
