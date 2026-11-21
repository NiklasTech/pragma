import { Plus } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import { Kbd } from "@/shared/components/ui/kbd";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";

/// Opens Quick start: a task, an agent, a layout and a place in one dialog.
export function NewTaskButton() {
  const shortcut = useSettingsStore((state) => state.shortcuts["session.quickStart"]);
  const openOverlay = useOverlayStore((state) => state.open);

  return (
    <Button
      variant="ghost"
      aria-label="new"
      onClick={() => openOverlay("quickStart")}
      className="px-2.25 text-ui-xs font-normal text-fg-default"
    >
      <Plus size={ICON_SIZE.sm} />
      <span className="max-md:hidden">new</span>
      {shortcut && <Kbd className="max-lg:hidden">{formatShortcut(shortcut, getIsMac())}</Kbd>}
    </Button>
  );
}
