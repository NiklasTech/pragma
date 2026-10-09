"use client";

import type { UIMessage } from "@ai-sdk/react";
import { Copy } from "@phosphor-icons/react";
import { toast } from "sonner";

import { copyToClipboard } from "@/shared/lib/clipboard";

import { MessageActionButton } from "../rewind/MessageActionBar";
import { messageToMarkdown } from "./markdown";
import { exportOptions } from "./sessionExport";

export function CopyMessageButton({ message }: { message: UIMessage }) {
  const copy = async () => {
    try {
      await copyToClipboard(messageToMarkdown(message, exportOptions(false)));
      toast.success("Copied message as Markdown");
    } catch (err) {
      toast.error(`Could not copy the message: ${String(err)}`);
    }
  };

  return (
    <MessageActionButton label="Copy as Markdown" onClick={() => void copy()}>
      <Copy size={13} />
    </MessageActionButton>
  );
}
