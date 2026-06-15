"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { File, FileText, Copy, Check, ArrowsClockwise } from "@phosphor-icons/react";
import { MarkdownCode } from "@/features/ai/components/MarkdownCode";
import { useEditorStore } from "@/shared/stores/editor";

const streamdownComponents: ComponentProps<typeof Streamdown>["components"] = {
  code({ className, children }) {
    return <MarkdownCode className={className}>{children}</MarkdownCode>;
  },
  inlineCode({ children }) {
    return (
      <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-ui-xs text-foreground">
        {children}
      </code>
    );
  },
};

function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".markdown");
}

function isHtmlFile(name: string): boolean {
  return name.toLowerCase().endsWith(".html") || name.toLowerCase().endsWith(".htm");
}

export default function PreviewPanel() {
  const { tabs, activeTabId } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const source = activeTab?.kind === "file" ? activeTab.content : "";
  const fileName = activeTab?.kind === "file" ? activeTab.name : null;

  const handleCopy = async () => {
    if (!source) return;
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!fileName) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
        <File size={32} className="text-fg-subtle" />
        <span>Open a file to preview it.</span>
      </div>
    );
  }

  const markdown = isMarkdownFile(fileName);
  const html = isHtmlFile(fileName);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 items-center justify-between border-b border-border bg-bg-surface px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-ui-xs text-fg-muted">
          <FileText size={14} />
          <span className="truncate">{fileName}</span>
          {html && (
            <span className="rounded bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-subtle">
              Live Preview
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {html && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="flex items-center gap-1 rounded px-2 py-1 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              <ArrowsClockwise size={14} />
              Reload
            </button>
          )}
          {!markdown && (
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="rounded px-2 py-1 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              {showRaw ? "Preview" : "Raw"}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
          >
            {copied ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {html && !showRaw ? (
          <iframe
            key={reloadKey}
            title={`Preview: ${fileName}`}
            srcDoc={source}
            className="h-full w-full rounded border border-border bg-white"
            sandbox="allow-scripts"
          />
        ) : markdown && !showRaw ? (
          <Streamdown
            className="prose prose-invert max-w-none text-ui-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={streamdownComponents}
            mode="static"
          >
            {source}
          </Streamdown>
        ) : (
          <pre className="h-full w-full overflow-auto rounded border border-border bg-bg-surface p-3 font-mono text-ui-sm text-fg-default">
            {source || "(empty file)"}
          </pre>
        )}
      </div>
    </div>
  );
}
