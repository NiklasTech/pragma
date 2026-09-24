"use client";

import { useEffect, useRef, useState } from "react";
import { Brain } from "@phosphor-icons/react";

import { ActivityBlock } from "./ActivityBlock";

type ReasoningBlockProps = {
  reasoning: string;
  streaming?: boolean;
};

export function ReasoningBlock({ reasoning, streaming = false }: ReasoningBlockProps) {
  const trimmed = reasoning.trim();
  const hasReasoning = trimmed.length > 0;
  const startRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!hasReasoning) {
      startRef.current = null;
      setElapsedSeconds(0);
      return;
    }
    const start = startRef.current ?? Date.now();
    startRef.current = start;
    if (!streaming) {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      return;
    }
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasReasoning, streaming]);

  if (!trimmed) return null;

  const title = elapsedSeconds > 0 ? `Thinking · ${elapsedSeconds}s` : "Thinking";

  return (
    <ActivityBlock
      icon={<Brain size={12} />}
      title={title}
      streaming={streaming}
      defaultOpen={false}
    >
      <pre className="whitespace-pre-wrap font-mono text-ui-xs leading-relaxed text-fg-muted">
        {trimmed}
      </pre>
    </ActivityBlock>
  );
}
