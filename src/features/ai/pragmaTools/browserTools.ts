import { readBooleanInput, readStringInput } from "@/features/agent/toolInput";

import { requestFrameAction, type BrowserAction } from "../browser/actions";
import { currentBrowserPage, runOpenBrowserTool } from "../browser/agentTool";
import { requestFrameConsole } from "../browser/console";
import { loadedBrowserFrame } from "../browser/frames";
import { useBrowserHistoryStore } from "../browser/history";
import type { PragmaToolHandler } from "./types";

const NAVIGATIONS = ["back", "forward", "reload"] as const;

async function onPage(action: BrowserAction, args: Record<string, unknown> = {}): Promise<string> {
  const page = currentBrowserPage();
  const { frame } = await loadedBrowserFrame(page.leafId, page.url);
  return requestFrameAction(frame, action, args);
}

function target(args: unknown): { selector: string; text: string } {
  const selector = readStringInput(args, "selector").trim();
  const text = readStringInput(args, "text").trim();
  if (!selector && !text) throw new Error("Give a selector or the text of the element.");
  return { selector, text };
}

async function navigate(args: unknown): Promise<string> {
  const action = readStringInput(args, "action");
  if (!action) return runOpenBrowserTool(args);
  if (!(NAVIGATIONS as readonly string[]).includes(action)) {
    throw new Error(`action must be one of ${NAVIGATIONS.join(", ")}`);
  }
  const page = currentBrowserPage();
  const history = useBrowserHistoryStore.getState();
  if (action === "back") history.back(page.leafId);
  else if (action === "forward") history.forward(page.leafId);
  else history.reload(page.leafId);
  return `Went ${action === "reload" ? "and reloaded" : action} in the browser pane.`;
}

async function network(): Promise<string> {
  const page = currentBrowserPage();
  const { frame } = await loadedBrowserFrame(page.leafId, page.url);
  const snapshot = await requestFrameConsole(frame);
  const failed = snapshot.entries.filter((entry) => entry.level === "network");
  if (failed.length === 0) return `No failed requests since ${snapshot.url} loaded.`;
  return [`Failed requests of ${snapshot.url}:`, ...failed.map((entry) => entry.text)].join("\n");
}

export const BROWSER_TOOLS: Record<string, PragmaToolHandler> = {
  browser_navigate: navigate,
  browser_read: () => onPage("read"),
  browser_click: async (args) => onPage("click", target(args)),
  browser_type: async (args) => {
    const value = readStringInput(args, "value");
    return onPage("type", { ...target(args), value, submit: readBooleanInput(args, "submit") });
  },
  browser_network: network,
};
