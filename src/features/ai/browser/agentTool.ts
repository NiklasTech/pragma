import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { openUrlInBrowser } from "./open";
import { parseBrowserUrl } from "./url";

function readUrlInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const url = (input as Record<string, unknown>).url;
  return typeof url === "string" ? url : "";
}

/// Opens the agent's URL in the browser pane without taking focus from the conversation.
export function runOpenBrowserTool(input: unknown): string {
  const parsed = parseBrowserUrl(readUrlInput(input));
  if (!parsed.ok) throw new Error(parsed.error);

  const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
  const result = openUrlInBrowser(rootPath, parsed.url, false);
  if (result === "full") {
    throw new Error("All 8 panes are in use, so no browser pane could be opened");
  }
  return `Opened ${parsed.url} in the browser pane. The user can see it; the page content is not returned.`;
}
