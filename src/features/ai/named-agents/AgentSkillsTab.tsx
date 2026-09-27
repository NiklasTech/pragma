"use client";

import { Sparkle } from "@phosphor-icons/react";

export function AgentSkillsTab() {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-6 text-center">
      <Sparkle size={20} className="text-fg-subtle" />
      <p className="text-ui-sm text-fg-muted">Skills are not available yet</p>
    </div>
  );
}
