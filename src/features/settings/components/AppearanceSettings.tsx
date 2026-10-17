import { AccessibilitySettings } from "./AccessibilitySettings";
import { EditorAppearanceSettings } from "./EditorAppearanceSettings";
import { InterfaceSettings } from "./InterfaceSettings";
import { ThemeSettings } from "./ThemeSettings";

export function AppearanceSettings() {
  return (
    <div className="flex flex-col gap-8">
      <ThemeSettings />
      <InterfaceSettings />
      <EditorAppearanceSettings />
      <AccessibilitySettings />
    </div>
  );
}
