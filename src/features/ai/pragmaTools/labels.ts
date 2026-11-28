import { readStringInput } from "@/features/agent/toolInput";

const LABELS: Record<string, { label: string; detailKey?: string }> = {
  lsp_diagnostics: { label: "Check problems", detailKey: "path" },
  lsp_definition: { label: "Find definition", detailKey: "symbol" },
  lsp_references: { label: "Find references", detailKey: "symbol" },
  lsp_hover: { label: "Look up symbol", detailKey: "symbol" },
  lsp_document_symbols: { label: "List symbols", detailKey: "path" },
  lsp_workspace_symbols: { label: "Find symbols", detailKey: "query" },
  editor_open: { label: "Open in editor", detailKey: "path" },
  editor_show_diff: { label: "Show changes", detailKey: "path" },
  editor_open_files: { label: "List open files" },
  editor_selection: { label: "Read selection" },
  review_request: { label: "Ask for review" },
  workspace_info: { label: "Read workspace" },
  local_history: { label: "Read file history", detailKey: "path" },
  local_history_restore: { label: "Restore file", detailKey: "path" },
  sessions_list: { label: "List sessions" },
  session_read: { label: "Read session", detailKey: "session" },
  session_send: { label: "Message session", detailKey: "title" },
  tasks_list: { label: "List tasks" },
  task_create: { label: "Add task", detailKey: "title" },
  task_update: { label: "Update task", detailKey: "task" },
  ask_user: { label: "Ask you", detailKey: "question" },
  notify_user: { label: "Notify you", detailKey: "message" },
};

/// How a built-in Pragma tool call reads in approvals and step lists.
export function pragmaToolLabel(
  toolName: string,
  input: unknown,
): { label: string; detail?: string } | null {
  if (toolName === "lsp_rename") {
    const from = readStringInput(input, "symbol");
    const to = readStringInput(input, "new_name");
    return { label: "Rename symbol", detail: from && to ? `${from} to ${to}` : undefined };
  }
  const entry = LABELS[toolName];
  if (!entry) return null;
  const detail = entry.detailKey ? readStringInput(input, entry.detailKey) : "";
  return { label: entry.label, detail: detail || undefined };
}
