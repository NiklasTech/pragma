"use client";

import { Switch } from "@/shared/components/ui/switch";
import { useChatContextSettings } from "@/features/ai/context/chatContextSettings";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

export function ChatContextSettings() {
  const { activeFile, openTabs, gitDiff, terminal, setSource } = useChatContextSettings();

  return (
    <SettingSection title="Chat Context">
      <SettingRow
        label="Active file and selection"
        description="Attach the file you are editing and any selected code to every chat message"
        control={
          <Switch
            checked={activeFile}
            onCheckedChange={(value) => setSource("activeFile", value)}
          />
        }
      />
      <SettingRow
        label="Other open tabs"
        description="Attach the paths and short excerpts of the other open editor tabs"
        control={
          <Switch checked={openTabs} onCheckedChange={(value) => setSource("openTabs", value)} />
        }
      />
      <SettingRow
        label="Workspace diff"
        description="Attach the staged and unstaged git diff, truncated to the token cap"
        control={
          <Switch checked={gitDiff} onCheckedChange={(value) => setSource("gitDiff", value)} />
        }
      />
      <SettingRow
        label="Terminal output"
        description="Attach the last lines shown in the active terminal"
        control={
          <Switch checked={terminal} onCheckedChange={(value) => setSource("terminal", value)} />
        }
      />
    </SettingSection>
  );
}
