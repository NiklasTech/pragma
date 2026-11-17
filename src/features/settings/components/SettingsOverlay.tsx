import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
} from "@/shared/components/ui/overlay-sheet";
import { useOverlayStore } from "@/shared/stores/overlays";

import { isCategory } from "./settings-categories";
import { Settings } from "./Settings";

/// Settings as a sheet on the right of the workspace, opened on the area a caller asked for.
export function SettingsOverlay() {
  const active = useOverlayStore((state) => state.active);
  const target = useOverlayStore((state) => state.target);
  const close = useOverlayStore((state) => state.close);
  const open = active === "settings";
  const [category, reveal] = (target ?? "").split("#");

  return (
    <OverlaySheet open={open} onOpenChange={(next) => !next && close("settings")}>
      <OverlaySheetContent
        placement="right"
        className="w-[min(560px,calc(100%-1rem))] rounded-[9px] transition-[opacity,translate,scale,width] has-[[data-settings-wide]]:w-[min(820px,calc(100%-1rem))]"
      >
        <OverlaySheetTitle className="sr-only">Settings</OverlaySheetTitle>
        {open && (
          <Settings
            key={target ?? "settings"}
            initialCategory={isCategory(category) ? category : undefined}
            initialReveal={reveal}
            onClose={() => close("settings")}
          />
        )}
      </OverlaySheetContent>
    </OverlaySheet>
  );
}
