"use client";

import { Plus, X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore, type TerminalEnvVar } from "@/shared/stores/settings";
import { SettingSection } from "./ui/SettingSection";

export function TerminalEnvSettings() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const envByWorkspace = useSettingsStore((s) => s.terminal.envByWorkspace);
  const setTerminalSettings = useSettingsStore((s) => s.setTerminalSettings);
  const vars = rootPath ? (envByWorkspace[rootPath] ?? []) : [];

  const setVars = (next: TerminalEnvVar[]) => {
    if (!rootPath) return;
    const updated = { ...envByWorkspace, [rootPath]: next };
    if (next.length === 0) delete updated[rootPath];
    setTerminalSettings({ envByWorkspace: updated });
  };

  const updateVar = (index: number, partial: Partial<TerminalEnvVar>) => {
    setVars(vars.map((item, i) => (i === index ? { ...item, ...partial } : item)));
  };

  return (
    <SettingSection
      title="Environment"
      action={
        <Button
          size="xs"
          variant="outline"
          onClick={() => setVars([...vars, { key: "", value: "" }])}
          disabled={!rootPath}
          className="gap-1"
        >
          <Plus size={12} />
          Add Variable
        </Button>
      }
    >
      <div className="flex flex-col gap-2 py-3">
        <span className="text-ui-xs leading-relaxed text-fg-subtle">
          {rootPath
            ? `Environment variables for new terminals in ${rootPath}.`
            : "Open a folder to set environment variables for its terminals."}
        </span>
        {vars.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item.key}
              onChange={(e) => updateVar(index, { key: e.target.value })}
              placeholder="NAME"
              aria-label="Variable name"
              aria-invalid={item.key.includes("=") || undefined}
              className="font-mono"
            />
            <Input
              value={item.value}
              onChange={(e) => updateVar(index, { value: e.target.value })}
              placeholder="value"
              aria-label="Variable value"
              className="font-mono"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setVars(vars.filter((_, i) => i !== index))}
              aria-label={`Remove ${item.key || "variable"}`}
            >
              <X size={13} />
            </Button>
          </div>
        ))}
      </div>
    </SettingSection>
  );
}
