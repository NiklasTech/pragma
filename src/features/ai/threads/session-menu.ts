import type { CLIManifest, CLIStatus } from "@/shared/stores/ai";

export type SessionMenuCliAction = "conversation" | "terminal";

export interface SessionMenuCliItem {
  action: SessionMenuCliAction;
  label: string;
}

export interface SessionMenuCliRow {
  manifestId: string;
  name: string;
  disabled: boolean;
  hint: string | null;
  items: SessionMenuCliItem[];
}

export function buildSessionMenuCliRows(
  manifests: CLIManifest[],
  statuses: Record<string, CLIStatus>,
): SessionMenuCliRow[] {
  return manifests.map((manifest) => {
    const installed = statuses[manifest.id]?.installed === true;
    if (!installed) {
      return {
        manifestId: manifest.id,
        name: manifest.name,
        disabled: true,
        hint: manifest.install_cmd,
        items: [],
      };
    }

    const items: SessionMenuCliItem[] = [
      ...(manifest.uses_acp ? [{ action: "conversation" as const, label: "Conversation" }] : []),
      ...(manifest.offers_terminal ? [{ action: "terminal" as const, label: "Terminal" }] : []),
    ];

    return {
      manifestId: manifest.id,
      name: manifest.name,
      disabled: false,
      hint: null,
      items,
    };
  });
}
