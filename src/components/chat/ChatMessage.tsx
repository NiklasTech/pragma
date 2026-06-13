import { User, Robot } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

interface HastElement {
  tagName?: string;
  properties?: { className?: string[] };
  children?: Array<{
    value?: string;
    tagName?: string;
    properties?: { className?: string[] };
    children?: Array<{ value?: string }>;
  }>;
}

function getCodeBlockInfo(
  node: HastElement | undefined,
): { language?: string; value: string } | null {
  const codeNode = node?.children?.find((child) => child.tagName === "code");
  if (!codeNode) return null;

  const classNames = codeNode.properties?.className ?? [];
  const language = classNames.find((c) => c.startsWith("language-"))?.slice(9);
  const value = codeNode.children?.map((c) => c.value).join("") ?? "";

  return { language, value };
}

const markdownComponents: Components = {
  pre({ node }) {
    const info = getCodeBlockInfo(node as HastElement | undefined);
    if (!info) return null;

    return <CodeBlock language={info.language} value={info.value} />;
  },

  code({ children }) {
    const value = Array.isArray(children)
      ? children.join("")
      : typeof children === "string"
        ? children
        : "";

    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
        {value}
      </code>
    );
  },

  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },

  ul({ children }) {
    return <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>;
  },

  ol({ children }) {
    return <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>;
  },

  li({ children }) {
    return <li className="mb-0.5">{children}</li>;
  },

  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {children}
      </a>
    );
  },

  blockquote({ children }) {
    return (
      <blockquote className="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  },

  hr() {
    return <hr className="my-3 border-border/40" />;
  },
};

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/15" : "bg-muted",
        )}
      >
        {isUser ? (
          <User size={14} className="text-primary" />
        ) : (
          <Robot size={14} className="text-muted-foreground" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground whitespace-pre-wrap"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          content
        ) : (
          <>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
            </div>
            {isStreaming && (
              <span className="mt-2 inline-flex h-4 items-center">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
