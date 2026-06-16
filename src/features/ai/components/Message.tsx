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
      "group flex w-full flex-col gap-2",
      from === "user" ? "is-user ml-auto max-w-[85%] items-end justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "select-text flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-ui-sm leading-relaxed",
      "group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-sm group-[.is-user]:bg-bg-hover/70 group-[.is-user]:px-3 group-[.is-user]:py-2 group-[.is-user]:text-fg-default",
      "group-[.is-assistant]:w-full group-[.is-assistant]:max-w-full group-[.is-assistant]:text-fg-default",
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
