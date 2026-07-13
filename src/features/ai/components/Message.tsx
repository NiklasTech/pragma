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
    className={cn(
      "group flex w-full",
      from === "user" ? "is-user justify-end" : "is-assistant justify-start",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-[92%] flex-col gap-2 overflow-hidden rounded-2xl px-4 py-3 text-ui-sm leading-relaxed",
      "group-[.is-user]:rounded-br-md group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
      "group-[.is-assistant]:rounded-tl-md group-[.is-assistant]:border group-[.is-assistant]:border-border/60 group-[.is-assistant]:bg-bg-elevated group-[.is-assistant]:text-fg-default",
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
      <code
        className={cn(
          "rounded px-1.5 py-0.5 font-mono text-ui-xs",
          "group-[.is-user]:bg-primary-foreground/15 group-[.is-user]:text-primary-foreground",
          "group-[.is-assistant]:bg-bg-hover/70 group-[.is-assistant]:text-fg-default",
        )}
      >
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
