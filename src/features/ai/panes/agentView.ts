import type { CLIManifest } from "@/shared/stores/ai";
import type { AgentView } from "@/shared/stores/settings";

export const AGENT_VIEW_LABELS: Record<AgentView, string> = {
  terminal: "Terminal",
  chat: "Pragma chat",
};

/** Where the default is set: a row of Settings › Agents. */
export const AGENT_VIEW_SETTING = "Show agents as";

type ViewSupport = Pick<CLIManifest, "uses_acp" | "offers_terminal">;

export function supportsAgentView(manifest: ViewSupport, view: AgentView): boolean {
  return view === "chat" ? manifest.uses_acp : manifest.offers_terminal;
}

/** The wanted view, or the only one the CLI has. */
export function resolveAgentView(manifest: ViewSupport, wanted: AgentView): AgentView {
  if (supportsAgentView(manifest, wanted)) return wanted;
  const other: AgentView = wanted === "chat" ? "terminal" : "chat";
  return supportsAgentView(manifest, other) ? other : wanted;
}
