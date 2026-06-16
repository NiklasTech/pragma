"use client";

import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { MarkdownCode } from "@/features/ai/components/MarkdownCode";
import { useEditorStore } from "@/shared/stores/editor";

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

export default function MarkdownPanel() {
  const { tabs, activeTabId } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const source = activeTab?.kind === "file" ? activeTab.content : "";
  const fileName = activeTab?.kind === "file" ? activeTab.name : "No file open";

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 items-center border-b border-border bg-bg-surface px-3 text-ui-xs text-fg-muted">
        <span className="truncate">{fileName}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {activeTab?.kind === "file" ? (
          <Streamdown
            className="prose prose-invert max-w-none text-ui-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={streamdownComponents}
            mode="static"
          >
            {source}
          </Streamdown>
        ) : (
          <div className="flex h-full items-center justify-center text-ui-sm text-fg-muted">
            Open a Markdown file to preview it.
          </div>
        )}
      </div>
    </div>
  );
}
