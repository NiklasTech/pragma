import { MagnifyingGlass } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";
import { Kbd } from "@/shared/components/ui/kbd";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";

export function GoToButton() {
  const shortcut = useSettingsStore((state) => state.shortcuts["file.goToFile"]);
  const openOverlay = useOverlayStore((state) => state.open);

  return (
    <Button
      variant="ghost"
      aria-label="go to"
      onClick={() => openOverlay("goTo")}
      className="px-2.25 text-ui-xs font-normal"
    >
      <MagnifyingGlass size={ICON_SIZE.sm} />
      <span className="max-md:hidden">go to</span>
      {shortcut && <Kbd className="max-lg:hidden">{formatShortcut(shortcut, getIsMac())}</Kbd>}
    </Button>
  );
}
