"use client";

import { Info } from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";
import type { WorkspaceSettings } from "@/shared/stores/workspaceSettings/types";

const LABELS: Record<string, string> = {
  tabSize: "tab size",
  insertSpaces: "insert spaces",
  formatOnSave: "format on save",
  trimTrailingWhitespace: "trim trailing whitespace",
  insertFinalNewline: "insert final newline",
  rulers: "rulers",
  allowedCommands: "allowed commands",
  stepLimit: "step limit",
  enabled: "language servers",
};

export function overriddenKeys(
  settings: WorkspaceSettings | null,
  section: keyof WorkspaceSettings,
): string[] {
  const values = settings?.[section];
  if (!values) return [];
  return Object.entries(values)
    .filter(
      ([, value]) =>
        value !== undefined && !(typeof value === "object" && !Object.keys(value).length),
    )
    .map(([key]) => LABELS[key] ?? key);
}

/// Tells the user which values on this page this folder's `.pragma/settings.json` sets.
export function WorkspaceOverrideNotice({ section }: { section: keyof WorkspaceSettings }) {
  const settings = useWorkspaceSettingsStore((state) => state.settings);
  const keys = overriddenKeys(settings, section);
  if (keys.length === 0) return null;

  return (
    <Alert variant="info">
      <Info />
      <AlertDescription className="text-ui-xs">
        This project sets {keys.join(", ")} in .pragma/settings.json. Those values apply on top of
        the ones below; edit them under Project.
      </AlertDescription>
    </Alert>
  );
}
