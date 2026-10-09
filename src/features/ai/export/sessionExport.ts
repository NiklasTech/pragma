import type { UIMessage } from "@ai-sdk/react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { copyToClipboard } from "@/shared/lib/clipboard";
import { loadSessionMessages } from "@/shared/lib/chat-storage";
import { storedMessagesToUI } from "@/shared/lib/ai/protocol";
import type { ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";

import { liveChat } from "../compaction/liveChat";
import { sessionToMarkdown, type MarkdownExportOptions } from "./markdown";

export function exportOptions(includeToolOutput: boolean): MarkdownExportOptions {
  return { includeToolOutput, includeReasoning: useSettingsStore.getState().ai.showThinking };
}

/// The open chat keeps tool calls and reasoning; stored messages only keep the text.
async function sessionMessages(session: ChatSession): Promise<UIMessage[]> {
  const live = liveChat(session.id)?.messages();
  if (live && live.length > 0) return live;
  if (session.messages.length > 0) return storedMessagesToUI(session.messages);
  const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
  return storedMessagesToUI(await loadSessionMessages(rootPath, session.id));
}

function fileName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "session"}.md`;
}

export async function copySessionMarkdown(
  session: ChatSession,
  includeToolOutput: boolean,
): Promise<void> {
  try {
    const markdown = sessionToMarkdown(
      session.title,
      await sessionMessages(session),
      exportOptions(includeToolOutput),
    );
    await copyToClipboard(markdown);
    toast.success("Copied session as Markdown");
  } catch (err) {
    toast.error(`Could not copy the session: ${String(err)}`);
  }
}

export async function exportSessionMarkdown(
  session: ChatSession,
  includeToolOutput: boolean,
): Promise<void> {
  try {
    const markdown = sessionToMarkdown(
      session.title,
      await sessionMessages(session),
      exportOptions(includeToolOutput),
    );
    const path = await save({
      defaultPath: fileName(session.title),
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!path) return;
    await invoke("write_text_file", { path, content: markdown });
    toast.success("Exported session as Markdown");
  } catch (err) {
    toast.error(`Could not export the session: ${String(err)}`);
  }
}
