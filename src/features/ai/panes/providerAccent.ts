import type { ChatSession } from "@/shared/stores/ai";

export interface ProviderAccent {
  /** Text color for the logo or kind icon. */
  text: string;
  /** Soft background behind an icon. */
  soft: string;
  /** Start color of the header gradient. */
  tint: string;
  /** Middle color of the activity sweep. */
  sweep: string;
}

const NEUTRAL: ProviderAccent = {
  text: "text-fg-default",
  soft: "bg-fg-default/8",
  tint: "from-fg-default/5",
  sweep: "via-fg-default/60",
};

const PRIMARY: ProviderAccent = {
  text: "text-primary",
  soft: "bg-primary/12",
  tint: "from-primary/10",
  sweep: "via-primary",
};

// Theme tokens that come closest to each provider's brand, so every theme can restyle them.
const PROVIDER_ACCENTS: Record<string, ProviderAccent> = {
  "anthropic-claude": {
    text: "text-brand-from",
    soft: "bg-brand-from/12",
    tint: "from-brand-from/12",
    sweep: "via-brand-to",
  },
  "google-gemini": {
    text: "text-status-info",
    soft: "bg-status-info/12",
    tint: "from-status-info/12",
    sweep: "via-status-info",
  },
  "github-copilot": {
    text: "text-syntax-keyword",
    soft: "bg-syntax-keyword/12",
    tint: "from-syntax-keyword/12",
    sweep: "via-syntax-keyword",
  },
  "moonshot-kimi": {
    text: "text-syntax-function",
    soft: "bg-syntax-function/12",
    tint: "from-syntax-function/12",
    sweep: "via-syntax-function",
  },
  "deepseek-harness": PRIMARY,
  "openai-codex": NEUTRAL,
  "cursor-agent": NEUTRAL,
  opencode: NEUTRAL,
};

export function providerAccentById(providerId: string): ProviderAccent {
  return PROVIDER_ACCENTS[providerId] ?? NEUTRAL;
}

export function providerAccent(session: ChatSession | undefined): ProviderAccent {
  return session?.cliProviderId ? providerAccentById(session.cliProviderId) : PRIMARY;
}

const SEEDED_ACCENTS: ProviderAccent[] = [
  PROVIDER_ACCENTS["anthropic-claude"],
  PROVIDER_ACCENTS["google-gemini"],
  PROVIDER_ACCENTS["github-copilot"],
  PROVIDER_ACCENTS["moonshot-kimi"],
  {
    text: "text-status-success",
    soft: "bg-status-success/12",
    tint: "from-status-success/12",
    sweep: "via-status-success",
  },
  {
    text: "text-status-warning",
    soft: "bg-status-warning/12",
    tint: "from-status-warning/12",
    sweep: "via-status-warning",
  },
];

/// A stable accent for things without a brand, such as named agents, picked from their id.
export function seededAccent(seed: string): ProviderAccent {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SEEDED_ACCENTS[hash % SEEDED_ACCENTS.length];
}
