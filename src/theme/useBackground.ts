import { useEffect, useMemo } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { applyBackgroundStyle, backgroundStyle } from "./background";
import type { Theme } from "./types";
import { useWindowTranslucencyStore, windowShowsThrough } from "./windowTranslucency";

/** Applies surface transparency over the background image or the translucent window. */
export function useBackground(theme: Theme): { terminalAlpha: number } {
  const settings = useSettingsStore((s) => s.background);
  const status = useWindowTranslucencyStore((s) => s.status);
  const load = useWindowTranslucencyStore((s) => s.load);
  const showsWindow = windowShowsThrough(status);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const style = useMemo(
    () => backgroundStyle(theme, settings, { image: Boolean(settings.image), window: showsWindow }),
    [theme, settings, showsWindow],
  );

  useEffect(() => {
    applyBackgroundStyle(style);
  }, [style]);

  return { terminalAlpha: style.terminalAlpha };
}
