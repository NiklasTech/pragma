import { AISettings } from "./AISettings";
import { AgentSettings } from "./AgentSettings";
import { NotificationSettings } from "./NotificationSettings";
import { EditorSettings } from "./EditorSettings";
import { TerminalSettings } from "./TerminalSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { McpSettings } from "./McpSettings";
import { LayoutSettings } from "./LayoutSettings";
import { KeyboardSettings } from "./KeyboardSettings";
import { AboutSettings } from "./AboutSettings";
import { ExtensionSettings } from "./ExtensionSettings";
import { LspSettings } from "./LspSettings";
import { SkillsSettings } from "./SkillsSettings";
import { VoiceSettings } from "./VoiceSettings";
import { ProjectSettings } from "./project/ProjectSettings";
import { TerminalEnvSettings } from "./TerminalEnvSettings";
import type { Category } from "./settings-categories";

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

export function SettingsCategoryContent({ category }: { category: Category }) {
  switch (category) {
    case "general":
      return <AboutSettings />;
    case "agents":
      return (
        <Stack>
          <AISettings part="agents" />
          <AgentSettings part="agents" />
          <NotificationSettings />
          <VoiceSettings />
        </Stack>
      );
    case "appearance":
      return <AppearanceSettings />;
    case "editor":
      return (
        <Stack>
          <EditorSettings />
          <AISettings part="models" />
          <LspSettings />
        </Stack>
      );
    case "terminal":
      return <TerminalSettings />;
    case "git":
      return <AgentSettings part="worktrees" />;
    case "spaces":
      return (
        <Stack>
          <LayoutSettings />
          <TerminalEnvSettings />
          <ProjectSettings />
        </Stack>
      );
    case "keys":
      return <KeyboardSettings />;
    case "extensions":
      return (
        <Stack>
          <McpSettings />
          <SkillsSettings />
          <ExtensionSettings />
        </Stack>
      );
  }
}
