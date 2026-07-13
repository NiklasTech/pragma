"use client";

import { PaperPlaneRight, Robot } from "@phosphor-icons/react";

type PromptChip = {
  label: string;
  prompt: string;
};

const DEFAULT_CHIPS: PromptChip[] = [
  { label: "Explain this project", prompt: "Explain the structure and purpose of this project." },
  { label: "Refactor selected code", prompt: "Refactor the selected code to be cleaner." },
  { label: "Find bugs in src/", prompt: "Look for potential bugs in the src directory." },
  { label: "Write a test", prompt: "Write a unit test for the current selection." },
];

export type ChatEmptyStateProps = {
  onPromptSelect?: (prompt: string) => void;
};

export function ChatEmptyState({ onPromptSelect }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full border border-accent/20 bg-accent/10 shadow-[0_0_40px_-10px_var(--color-accent-glow)]">
        <Robot size={32} weight="fill" className="text-primary" />
      </div>

      <h2 className="text-ui-lg font-semibold tracking-tight">What are we building?</h2>
      <p className="mt-2 max-w-[280px] text-ui-sm text-fg-muted">
        Ask anything about your codebase, generate code, or run commands through the AI.
      </p>

      <div className="mt-6 flex max-w-[320px] flex-wrap justify-center gap-2">
        {DEFAULT_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onPromptSelect?.(chip.prompt)}
            className="rounded-full border border-border/60 bg-bg-elevated px-3.5 py-2 text-ui-xs text-fg-muted transition-colors hover:border-border hover:bg-bg-hover hover:text-fg-default"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-ui-xs text-fg-subtle">
        <PaperPlaneRight size={12} weight="bold" />
        <span>Start typing or pick a suggestion</span>
      </div>
    </div>
  );
}
