import { useMemo } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  formatShortcut,
  getIsMac,
  SHORTCUT_ACTIONS,
  type ShortcutActionId,
} from "@/shared/lib/shortcuts";
import { Kbd, KbdGroup } from "@/shared/components/ui/kbd";

const HIGHLIGHTED_SHORTCUTS: ShortcutActionId[] = [
  "file.open",
  "file.save",
  "file.closeTab",
  "view.toggleSidebar",
  "view.toggleTerminal",
  "view.openSettings",
  "ai.toggle",
];

export function ShortcutsStep() {
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const isMac = getIsMac();

  const items = useMemo(() => {
    const actionMap = new Map(SHORTCUT_ACTIONS.map((a) => [a.id, a]));
    return HIGHLIGHTED_SHORTCUTS.map((id) => {
      const action = actionMap.get(id);
      const binding = shortcuts[id];
      return {
        id,
        label: action?.label ?? id,
        shortcut: formatShortcut(binding, isMac),
      };
    });
  }, [shortcuts, isMac]);

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-fg-default">Keyboard shortcuts</h2>
        <p className="text-ui-sm text-fg-muted">
          You can customize these anytime in Settings → Keyboard.
        </p>
      </div>

      <div className="grid gap-2">
        {items.map(({ id, label, shortcut }) => (
          <div
            key={id}
            className="flex items-center justify-between rounded-md border border-border/30 px-4 py-2.5"
          >
            <span className="text-ui-sm text-fg-default">{label}</span>
            <KbdGroup>
              {shortcut
                .split(/(\+)/)
                .map((part, i) => (part === "+" ? null : <Kbd key={`${id}-${i}`}>{part}</Kbd>))}
            </KbdGroup>
          </div>
        ))}
      </div>
    </div>
  );
}
