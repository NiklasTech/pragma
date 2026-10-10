import {
  useSettingsStore,
  type AgentSettings,
  type EditorSettings,
} from "@/shared/stores/settings";

import { useWorkspaceSettingsStore } from "./store";
import { isFolderTrusted } from "./trust";
import type { WorkspaceSettings } from "./types";

/// Workspace editor values win over the user's.
export function mergeEditorSettings(
  user: EditorSettings,
  workspace: WorkspaceSettings | null,
): EditorSettings {
  return { ...user, ...workspace?.editor };
}

/// Workspace commands add to the user's, and only once the workspace is trusted.
export function mergeAgentSettings(
  user: AgentSettings,
  workspace: WorkspaceSettings | null,
  trusted: boolean,
): AgentSettings {
  const agent = workspace?.agent;
  const extra = trusted ? (agent?.allowedCommands ?? []) : [];
  return {
    ...user,
    allowedCommands: [...new Set([...user.allowedCommands, ...extra])],
    stepLimit: agent?.stepLimit ?? user.stepLimit,
  };
}

export function lspEnabledFor(
  userEnabled: Record<string, boolean>,
  workspace: WorkspaceSettings | null,
  language: string,
): boolean {
  return workspace?.lsp?.enabled?.[language] ?? userEnabled[language] ?? true;
}

function isTrusted(): boolean {
  return isFolderTrusted(useWorkspaceSettingsStore.getState().rootPath);
}

export function getEditorSettings(): EditorSettings {
  return mergeEditorSettings(
    useSettingsStore.getState().editor,
    useWorkspaceSettingsStore.getState().settings,
  );
}

export function getAgentSettings(): AgentSettings {
  return mergeAgentSettings(
    useSettingsStore.getState().agent,
    useWorkspaceSettingsStore.getState().settings,
    isTrusted(),
  );
}

export function isLspEnabled(language: string): boolean {
  return lspEnabledFor(
    useSettingsStore.getState().lsp.enabled,
    useWorkspaceSettingsStore.getState().settings,
    language,
  );
}

export function useEditorSetting<K extends keyof EditorSettings>(key: K): EditorSettings[K] {
  const user = useSettingsStore((state) => state.editor[key]);
  const workspace = useWorkspaceSettingsStore(
    (state) => (state.settings?.editor as Partial<EditorSettings> | undefined)?.[key],
  );
  return workspace ?? user;
}

export function useLspEnabled(language: string | null | undefined): boolean {
  const user = useSettingsStore((state) => state.lsp.enabled[language ?? ""]);
  const workspace = useWorkspaceSettingsStore(
    (state) => state.settings?.lsp?.enabled?.[language ?? ""],
  );
  return workspace ?? user ?? true;
}
