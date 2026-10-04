import { AISettings } from "./AISettings";
import { AgentSettings } from "./AgentSettings";
import { NotificationSettings } from "./NotificationSettings";
import { EditorSettings } from "./EditorSettings";
import { TerminalSettings } from "./TerminalSettings";
import { ThemeSettings } from "./ThemeSettings";
import { McpSettings } from "./McpSettings";
import { LayoutSettings } from "./LayoutSettings";
import { KeyboardSettings } from "./KeyboardSettings";
import { AboutSettings } from "./AboutSettings";
import { ExtensionSettings } from "./ExtensionSettings";
import { LspSettings } from "./LspSettings";
import { VoiceSettings } from "./VoiceSettings";
import type { Category } from "./settings-categories";

export function SettingsCategoryContent({ category }: { category: Category }) {
  return (
    <>
      {category === "editor" && <EditorSettings />}
      {category === "terminal" && <TerminalSettings />}
      {category === "agents" && (
        <div className="flex flex-col gap-8">
          <AISettings />
          <AgentSettings />
          <NotificationSettings />
        </div>
      )}
      {category === "voice" && <VoiceSettings />}
      {category === "theme" && <ThemeSettings />}
      {category === "mcp" && <McpSettings />}
      {category === "layout" && <LayoutSettings />}
      {category === "keyboard" && <KeyboardSettings />}
      {category === "languages" && <LspSettings />}
      {category === "extensions" && <ExtensionSettings />}
      {category === "about" && <AboutSettings />}
    </>
  );
}
