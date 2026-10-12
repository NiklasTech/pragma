import type { CLIManifest } from "@/shared/stores/ai";
import { formatRulesForPrompt, type ProjectRules } from "@/features/agent/rules";
import { composeAgentSystemPrompt } from "@/features/ai/named-agents/prompt";

export function nativeRulesFiles(
  manifests: CLIManifest[],
  cliProviderId: string | null,
): readonly string[] {
  return manifests.find((manifest) => manifest.id === cliProviderId)?.native_rules_files ?? [];
}

export function buildCliLeadingMessage(
  agentBlock: string | null,
  rules: ProjectRules | null,
  skillsBlock: string | null,
  nativeFiles: readonly string[],
): string | null {
  const rulesBlock =
    rules && !nativeFiles.includes(rules.path) ? formatRulesForPrompt(rules) : null;
  return composeAgentSystemPrompt(agentBlock, rulesBlock, skillsBlock) ?? null;
}
