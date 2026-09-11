"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/shared/lib/utils";
import { MarkdownCode } from "./MarkdownCode";
import { ChatStreamingProvider } from "./ChatCodeBlock";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn("group flex w-full", from === "user" ? "is-user" : "is-assistant", className)}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "flex w-full min-w-0 flex-col gap-2 text-ui-sm leading-relaxed",
      "group-[.is-user]:text-fg-muted group-[.is-assistant]:text-fg-default",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

const streamdownComponents: ComponentProps<typeof Streamdown>["components"] = {
  code({ className, children }) {
    return <MarkdownCode className={className}>{children}</MarkdownCode>;
  },
  inlineCode({ children }) {
    return (
      <code className="rounded bg-bg-hover/70 px-1.5 py-0.5 font-mono text-ui-xs text-fg-default">
        {children}
      </code>
    );
  },
};

export type MessageResponseProps = ComponentProps<typeof Streamdown> & {
  streaming?: boolean;
};

export const MessageResponse = memo(
  ({ className, streaming = false, children, ...props }: MessageResponseProps) => (
    <ChatStreamingProvider value={streaming}>
      <Streamdown
        className={cn(
          "size-full text-ui-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className,
        )}
        components={streamdownComponents}
        mode={streaming ? "streaming" : "static"}
        parseIncompleteMarkdown={streaming}
        isAnimating={streaming}
        {...props}
      >
        {children}
      </Streamdown>
    </ChatStreamingProvider>
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children && prevProps.streaming === nextProps.streaming,
);

MessageResponse.displayName = "MessageResponse";
