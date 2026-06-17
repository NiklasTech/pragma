"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";

export function TerminalSettings() {
  const { terminal, setTerminalSettings } = useSettingsStore();
  const terminalStore = useTerminalStore();

  const update = (partial: Parameters<typeof setTerminalSettings>[0]) => {
    setTerminalSettings(partial);
    if ("shell" in partial) terminalStore.setDefaultShell(partial.shell ?? terminal.shell);
    if ("fontSize" in partial) terminalStore.setFontSize(partial.fontSize ?? terminal.fontSize);
    if ("fontFamily" in partial)
      terminalStore.setFontFamily(partial.fontFamily ?? terminal.fontFamily);
    if ("scrollback" in partial)
      terminalStore.setScrollback(partial.scrollback ?? terminal.scrollback);
    if ("aiSuggestions" in partial)
      terminalStore.setAiSuggestions(partial.aiSuggestions ?? terminal.aiSuggestions);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Shell</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Default Shell</Label>
            <Input
              value={terminal.shell}
              onChange={(e) => update({ shell: e.target.value })}
              placeholder="/bin/zsh"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Font Size</Label>
            <Input
              type="number"
              min={8}
              max={32}
              value={terminal.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Font Family</Label>
            <Input
              value={terminal.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              placeholder="JetBrains Mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Scrollback Lines</Label>
            <Input
              type="number"
              min={1000}
              step={1000}
              value={terminal.scrollback}
              onChange={(e) => update({ scrollback: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="terminal-ai-suggestions">
              Command Suggestions
            </Label>
            <Switch
              id="terminal-ai-suggestions"
              checked={terminal.aiSuggestions}
              onCheckedChange={(v) => update({ aiSuggestions: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
