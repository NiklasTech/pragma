"use client";

import * as React from "react";
import { Plus, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore, type AgentAutoApprove } from "@/shared/stores/settings";

import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const AUTO_APPROVE_OPTIONS: Array<{ value: AgentAutoApprove; label: string }> = [
  { value: "never", label: "Ask for everything" },
  { value: "edits", label: "Auto-approve file edits" },
  { value: "all", label: "Auto-approve everything" },
];

export function AgentSettings() {
  const { agent, setAgentSettings } = useSettingsStore();
  const [newCommand, setNewCommand] = React.useState("");

  const addCommand = () => {
    const pattern = newCommand.trim();
    if (!pattern || agent.allowedCommands.includes(pattern)) {
      setNewCommand("");
      return;
    }
    setAgentSettings({ allowedCommands: [...agent.allowedCommands, pattern] });
    setNewCommand("");
  };

  const removeCommand = (pattern: string) => {
    setAgentSettings({
      allowedCommands: agent.allowedCommands.filter((p) => p !== pattern),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Agent Mode">
        <SettingRow
          label="Enable Agent Mode"
          description="Adds an Agent toggle to the chat. The agent works autonomously with workspace tools until the task is done."
          control={
            <Switch
              checked={agent.enabled}
              onCheckedChange={(v) => setAgentSettings({ enabled: v })}
              aria-label="Enable Agent Mode"
            />
          }
        />
        <SettingRow
          label="Auto-approve"
          description="Which destructive actions (file writes, shell commands) run without asking."
          disabled={!agent.enabled}
          control={
            <Select
              value={agent.autoApprove}
              onValueChange={(value) =>
                setAgentSettings({ autoApprove: value as AgentAutoApprove })
              }
            >
              <SelectTrigger className="max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_APPROVE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </SettingSection>

      <SettingSection title="Allowed Commands">
        <div className="py-2.5">
          <p className="mb-3 text-ui-xs text-fg-muted">
            Shell commands matching one of these patterns run without approval, even when
            auto-approve is off. A pattern matches the exact command or the command with extra
            arguments; end a pattern with * for a plain prefix match.
          </p>
          <div className="mb-2 flex items-center gap-2">
            <Input
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCommand();
                }
              }}
              placeholder="e.g. pnpm test"
              className="h-7 text-ui-sm"
              disabled={!agent.enabled}
            />
            <Button
              size="xs"
              variant="outline"
              onClick={addCommand}
              disabled={!agent.enabled || !newCommand.trim()}
              className="gap-1"
            >
              <Plus size={14} />
              Add
            </Button>
          </div>
          {agent.allowedCommands.length === 0 ? (
            <p className="text-ui-xs text-fg-subtle">No allowed commands configured.</p>
          ) : (
            <div className="flex flex-col">
              {agent.allowedCommands.map((pattern) => (
                <div
                  key={pattern}
                  className="flex items-center justify-between gap-2 border-b border-border/30 py-1.5 last:border-b-0"
                >
                  <code className="min-w-0 flex-1 truncate font-mono text-ui-xs text-fg-muted">
                    {pattern}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Remove pattern"
                    onClick={() => removeCommand(pattern)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
}
