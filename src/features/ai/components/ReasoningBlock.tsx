"use client";

import { Brain } from "@phosphor-icons/react";

import { ActivityBlock } from "./ActivityBlock";

type ReasoningBlockProps = {
  reasoning: string;
  streaming?: boolean;
};

export function ReasoningBlock({ reasoning, streaming = false }: ReasoningBlockProps) {
  const trimmed = reasoning.trim();
  if (!trimmed) return null;

  return (
    <ActivityBlock
      icon={<Brain size={12} />}
      title={streaming ? "Thinking…" : "Thought process"}
      streaming={streaming}
      defaultOpen={streaming}
    >
      <pre className="whitespace-pre-wrap font-mono text-ui-xs leading-relaxed text-fg-muted">
        {trimmed}
      </pre>
    </ActivityBlock>
  );
}
