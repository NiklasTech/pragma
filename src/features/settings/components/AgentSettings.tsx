"use client";

import * as React from "react";
import { Info, Plus, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useSettingsStore, type AgentAutoApprove } from "@/shared/stores/settings";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
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
    <div className="flex flex-col gap-8">
      <SettingSection title="Approvals">
        <SettingRow
          label="Auto-approve"
          description="Which destructive actions (file writes, shell commands) run without asking."
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
        <SettingRow
          label="Step limit"
          description="Stop a run after this many tool calls. Leave empty for no limit."
          control={
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={agent.stepLimit ?? ""}
              placeholder="No limit"
              aria-label="Step limit"
              className="h-7 w-28 text-ui-sm"
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  setAgentSettings({ stepLimit: null });
                  return;
                }
                const value = Number(raw);
                if (!Number.isInteger(value) || value < 1) return;
                setAgentSettings({ stepLimit: value });
              }}
            />
          }
        />
      </SettingSection>

      <SettingSection title="Allowed Commands">
        <div className="py-2.5">
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-ui-sm text-fg-default">Patterns</span>
            <Tooltip>
              <TooltipTrigger
                type="button"
                delay={100}
                aria-label="About allowed commands"
                className="flex items-center text-fg-subtle transition-colors hover:text-fg-default"
              >
                <Info size={14} />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                Shell commands matching one of these patterns run without approval, even when
                auto-approve is off. A pattern matches the exact command or the command with extra
                arguments; end a pattern with * for a plain prefix match.
              </TooltipContent>
            </Tooltip>
          </div>
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
            />
            <Button
              size="xs"
              variant="outline"
              onClick={addCommand}
              disabled={!newCommand.trim()}
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
