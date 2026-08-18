export const EXTENSION_FORMAT = "pragma-extension-v1";

export interface ExtensionCommandContribution {
  id: string;
  title: string;
  category?: string;
}

export interface ExtensionPanelContribution {
  id: string;
  title: string;
  icon?: string;
  html?: string;
}

export interface ExtensionThemePathContribution {
  path: string;
}

export type ExtensionThemeContribution = unknown;

export interface ExtensionContributes {
  commands?: ExtensionCommandContribution[];
  themes?: ExtensionThemeContribution[];
  panels?: ExtensionPanelContribution[];
}

export interface ExtensionManifest {
  format: typeof EXTENSION_FORMAT;
  id: string;
  name: string;
  version: string;
  description?: string;
  main: string;
  contributes?: ExtensionContributes;
}

export interface ExtensionSummary {
  id: string;
  name: string;
  version: string;
  description: string | null;
  path: string;
  manifest: unknown;
  error: string | null;
}

export interface BridgeRequest {
  kind: "request";
  id: number;
  method: string;
  params?: unknown;
}

export interface BridgeResponse {
  kind: "response";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface BridgeEvent {
  kind: "event";
  event: string;
  data?: unknown;
}
