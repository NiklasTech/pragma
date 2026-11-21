"use client";

import type { UIMessage } from "@ai-sdk/react";
import { Copy } from "@phosphor-icons/react";
import { toast } from "sonner";

import { copyToClipboard } from "@/shared/lib/clipboard";

import { MessageActionButton } from "../rewind/MessageActionBar";
import { messageToMarkdown } from "./markdown";
import { exportOptions } from "./sessionExport";

/** Copies a reply as Markdown and says so. */
export async function copyMessageAsMarkdown(message: UIMessage): Promise<void> {
  try {
    await copyToClipboard(messageToMarkdown(message, exportOptions(false)));
    toast.success("Copied message as Markdown");
  } catch (err) {
    toast.error(`Could not copy the message: ${String(err)}`);
  }
}

export function CopyMessageButton({ message }: { message: UIMessage }) {
  return (
    <MessageActionButton
      label="Copy as Markdown"
      onClick={() => void copyMessageAsMarkdown(message)}
    >
      <Copy size={13} />
    </MessageActionButton>
  );
}
