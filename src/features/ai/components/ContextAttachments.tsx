"use client";

import { FileText, Files, GitDiff, Terminal } from "@phosphor-icons/react";

import type { AutoContextAttachment } from "@/shared/lib/chat-context";

function attachmentIcon(id: string) {
  if (id === "active-file") return <FileText size={11} weight="bold" className="shrink-0" />;
  if (id === "open-tabs") return <Files size={11} weight="bold" className="shrink-0" />;
  if (id === "git-diff") return <GitDiff size={11} weight="bold" className="shrink-0" />;
  if (id === "terminal") return <Terminal size={11} weight="bold" className="shrink-0" />;
  return <FileText size={11} weight="bold" className="shrink-0" />;
}

export interface ContextAttachmentsProps {
  attachments: readonly AutoContextAttachment[];
  truncated: boolean;
}

export function ContextAttachments({ attachments, truncated }: ContextAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-ui-2xs text-fg-muted">
      <span className="font-medium">Context attached</span>
      {attachments.map((attachment) => (
        <span
          key={attachment.id}
          title={`Approximately ${attachment.tokens} tokens`}
          className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface px-2 py-0.5"
        >
          <span className="shrink-0 text-fg-subtle">{attachmentIcon(attachment.id)}</span>
          <span className="max-w-[180px] truncate">{attachment.label}</span>
          <span className="shrink-0 text-fg-subtle">~{attachment.tokens}</span>
        </span>
      ))}
      {truncated && <span className="text-fg-subtle">capped at token limit</span>}
    </div>
  );
}
