import { useSettingsStore } from "@/shared/stores/settings";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { Kbd } from "@/shared/components/ui/kbd";

const HINTS = [
  { action: "file.open", label: "Open File" },
  { action: "file.goToFile", label: "Go to File" },
  { action: "view.commandPalette", label: "Command Palette" },
] as const;

export function EditorEmptyState() {
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const isMac = getIsMac();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 select-none">
      <img src="/pragma_logo.svg" alt="" className="size-14 opacity-25" />

      <div className="flex flex-col items-center gap-2.5">
        {HINTS.map(({ action, label }) => (
          <div key={action} className="flex items-center gap-3 text-ui-xs text-fg-subtle">
            <span className="w-28 text-right">{label}</span>
            <Kbd>{formatShortcut(shortcuts[action], isMac)}</Kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
