export type AgentColor = "claude" | "codex" | "gemini" | "opencode" | "other";

export interface AgentIdentity {
  /** One letter shown in the agent mark; unique across the built-in CLIs. */
  letter: string;
  color: AgentColor;
}

// Keyed by the CLI manifest id in src-tauri/src/ai/cli/manifest.rs.
const IDENTITIES: Record<string, AgentIdentity> = {
  "anthropic-claude": { letter: "C", color: "claude" },
  "openai-codex": { letter: "X", color: "codex" },
  "google-gemini": { letter: "G", color: "gemini" },
  opencode: { letter: "O", color: "opencode" },
  "moonshot-kimi": { letter: "K", color: "other" },
  "github-copilot": { letter: "P", color: "other" },
  "xai-grok": { letter: "R", color: "other" },
  "cursor-agent": { letter: "U", color: "other" },
  "hermes-agent": { letter: "H", color: "other" },
  "deepseek-harness": { letter: "D", color: "other" },
};

export const KNOWN_AGENT_IDS = Object.keys(IDENTITIES);

/** The mark of a CLI; unknown ids get the first letter of their name in the neutral color. */
export function agentIdentity(manifestId: string | undefined, name: string): AgentIdentity {
  const known = manifestId ? IDENTITIES[manifestId] : undefined;
  if (known) return known;
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return { letter, color: "other" };
}
