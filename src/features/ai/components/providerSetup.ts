import type { AIProvider, CLIManifest, CLIStatus } from "@/shared/stores/ai";

export type ProviderSetup =
  /** The chat's engine can answer. */
  | { kind: "ready" }
  /** The coding CLIs are still being checked, so nothing is known to be missing yet. */
  | { kind: "checking" }
  /** No coding CLI is signed in and no provider is set up at all. */
  | { kind: "nothing" }
  /** Something else is set up, just not this chat's engine; `cli` is a CLI it could switch to. */
  | { kind: "otherEngine"; cli: CLIManifest | null };

export interface ProviderSetupInput {
  canChat: boolean;
  cliStatusesLoaded: boolean;
  cliStatuses: Record<string, CLIStatus>;
  cliManifests: readonly CLIManifest[];
  activeCLIProvider: string | null;
  apiKeyRefs: Record<AIProvider, string | null>;
  copilotAuthenticated: boolean;
  customBaseUrl: string | undefined;
}

function signedInClis(input: ProviderSetupInput): CLIManifest[] {
  return input.cliManifests.filter((manifest) => {
    const status = input.cliStatuses[manifest.id];
    return manifest.uses_acp && status?.installed === true && status.authenticated;
  });
}

/// What the chat composer should say about the engine: nothing, a one-time setup hint, or a way
/// to switch this chat to an engine that is set up.
export function providerSetup(input: ProviderSetupInput): ProviderSetup {
  if (input.canChat) return { kind: "ready" };
  if (!input.cliStatusesLoaded) return { kind: "checking" };
  const clis = signedInClis(input);
  const anyKey = Object.values(input.apiKeyRefs).some((ref) => ref !== null);
  const anything =
    clis.length > 0 || anyKey || input.copilotAuthenticated || Boolean(input.customBaseUrl);
  if (!anything) return { kind: "nothing" };
  const preferred = clis.find((cli) => cli.id === input.activeCLIProvider) ?? clis[0] ?? null;
  return { kind: "otherEngine", cli: preferred };
}
