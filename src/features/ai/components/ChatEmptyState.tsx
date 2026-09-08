"use client";

import { Robot } from "@phosphor-icons/react";

export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <Robot size={18} className="text-fg-muted" />
      <p className="text-ui-sm text-fg-muted">Ask about the codebase.</p>
    </div>
  );
}
