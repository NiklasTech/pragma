import type { CLIManifest } from "@/shared/stores/ai";

/**
 * True when the active CLI provider declares ACP support in its manifest.
 * This keeps ACP activation manifest-driven instead of tied to a provider id.
 */
export function isAcpActive(
  manifests: CLIManifest[],
  activeCLIProvider: string | null,
  experimentalAcp: boolean,
): boolean {
  if (!experimentalAcp || !activeCLIProvider) return false;
  return manifests.find((m) => m.id === activeCLIProvider)?.uses_acp === true;
}
