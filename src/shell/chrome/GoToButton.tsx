import { MagnifyingGlass } from "@phosphor-icons/react";

import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import { Kbd } from "@/shared/components/ui/kbd";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";

export function GoToButton() {
  const shortcut = useSettingsStore((state) => state.shortcuts["file.goToFile"]);
  const openOverlay = useOverlayStore((state) => state.open);

  return (
    <button
      type="button"
      onClick={() => openOverlay("goTo")}
      className="flex h-7.5 items-center gap-2 rounded-control px-2.25 text-ui-xs text-fg-muted transition-colors outline-none hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <MagnifyingGlass size={ICON_SIZE.sm} />
      Go to
      {shortcut && <Kbd>{formatShortcut(shortcut, getIsMac())}</Kbd>}
    </button>
  );
}
