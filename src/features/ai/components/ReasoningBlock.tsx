"use client";

import { Sparkle } from "@phosphor-icons/react";

import { ActivityBlock } from "./ActivityBlock";
import { PulseDot } from "./PulseDot";
import { useElapsedSeconds } from "./useElapsedSeconds";

type ReasoningBlockProps = {
  reasoning: string;
  streaming?: boolean;
  defaultOpen?: boolean;
};

export function ReasoningBlock({
  reasoning,
  streaming = false,
  defaultOpen = false,
}: ReasoningBlockProps) {
  const trimmed = reasoning.trim();
  const seconds = useElapsedSeconds(streaming && trimmed.length > 0);

  if (!trimmed) return null;

  const title = streaming ? "Thinking" : seconds > 0 ? `Thought for ${seconds}s` : "Thought";

  return (
    <ActivityBlock
      icon={
        streaming ? (
          <PulseDot />
        ) : (
          <Sparkle
            size={13}
            weight="duotone"
            className="animate-in text-fg-subtle duration-200 zoom-in-50 motion-reduce:animate-none"
          />
        )
      }
      title={title}
      meta={streaming && seconds > 0 ? `${seconds}s` : undefined}
      streaming={streaming}
      defaultOpen={defaultOpen}
    >
      <pre className="font-mono text-ui-xs leading-relaxed whitespace-pre-wrap text-fg-muted">
        {trimmed}
      </pre>
    </ActivityBlock>
  );
}
