import type { ToolImageOutput } from "@/shared/lib/ai/toolOutput";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { AGENT_TOOL_NAMES } from "@/features/agent/tools";

import { findBrowserLeaf } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";
import { formatConsole, requestFrameConsole } from "./console";
import { loadedBrowserFrame } from "./frames";
import { currentUrl, useBrowserHistoryStore } from "./history";
import { openUrlInBrowser } from "./open";
import { captureFrame } from "./screenshot";
import { parseBrowserUrl } from "./url";

const DEFAULT_CONSOLE_LIMIT = 50;
const MAX_CONSOLE_LIMIT = 200;
/** Gives a page that just loaded time to render before the screenshot. */
const SETTLE_MS = 500;

function readUrlInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const url = (input as Record<string, unknown>).url;
  return typeof url === "string" ? url : "";
}

function readLimitInput(input: unknown): number {
  if (typeof input !== "object" || input === null) return DEFAULT_CONSOLE_LIMIT;
  const limit = (input as Record<string, unknown>).limit;
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_CONSOLE_LIMIT;
  return Math.min(MAX_CONSOLE_LIMIT, Math.max(1, Math.floor(limit)));
}

function workspaceRoot(): string {
  return useFileExplorerStore.getState().rootPath ?? "default";
}

/// Opens the agent's URL in the browser pane without taking focus from the conversation.
export function runOpenBrowserTool(input: unknown): string {
  const parsed = parseBrowserUrl(readUrlInput(input));
  if (!parsed.ok) throw new Error(parsed.error);

  const result = openUrlInBrowser(workspaceRoot(), parsed.url, false);
  if (result === "full") {
    throw new Error("All 8 panes are in use, so no browser pane could be opened");
  }
  return `Opened ${parsed.url} in the browser pane. The user can see it; the page content is not returned.`;
}

function currentBrowserPage(): { leafId: string; url: string } {
  const root = useAgentsPanesStore.getState().trees[workspaceRoot()]?.root ?? null;
  const leaf = findBrowserLeaf(root);
  const url = leaf ? currentUrl(useBrowserHistoryStore.getState().byLeaf[leaf.id]) : null;
  if (!leaf || !url) {
    throw new Error(
      `No page is open in the browser pane. Open one with ${AGENT_TOOL_NAMES.openBrowser} first.`,
    );
  }
  return { leafId: leaf.id, url };
}

/// Screenshots the page in the browser pane once it has loaded.
export async function runBrowserScreenshotTool(): Promise<ToolImageOutput> {
  const page = currentBrowserPage();
  const { frame, waited } = await loadedBrowserFrame(page.leafId, page.url);
  if (waited) await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  const image = await captureFrame(frame);
  return { text: `Screenshot of ${page.url} in the browser pane.`, images: [image] };
}

/// Reads the console entries the page in the browser pane recorded since it loaded.
export async function runBrowserConsoleTool(input: unknown): Promise<string> {
  const page = currentBrowserPage();
  const { frame } = await loadedBrowserFrame(page.leafId, page.url);
  return formatConsole(await requestFrameConsole(frame), readLimitInput(input));
}
