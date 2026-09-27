"use client";

import { At, Robot } from "@phosphor-icons/react";

import { PragmaMark } from "@/shared/components/PragmaMark";

const TIPS = [
  { icon: At, text: "Type @ to reference files and folders" },
  { icon: Robot, text: "Agent mode plans, edits and runs commands for you" },
];

export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <PragmaMark className="size-8 text-fg-default opacity-80" />
      <p className="max-w-[40ch] text-ui-md font-medium text-fg-default">
        Ask Pragma to work in this folder.
      </p>
      <div className="flex max-w-[34ch] flex-col gap-1.5">
        {TIPS.map((tip) => (
          <span
            key={tip.text}
            className="flex items-start gap-2 text-left text-ui-xs text-fg-subtle"
          >
            <tip.icon size={13} className="mt-0.5 shrink-0" />
            {tip.text}
          </span>
        ))}
      </div>
    </div>
  );
}
