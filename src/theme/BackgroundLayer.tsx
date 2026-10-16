import { useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/shared/stores/settings";
import { clampBlur, clampDim, type BackgroundFit } from "./background";
import { resolveValue } from "./tokenResolution";
import type { Theme } from "./types";

const FIT_STYLES: Record<BackgroundFit, CSSProperties> = {
  cover: { backgroundSize: "cover", backgroundRepeat: "no-repeat" },
  contain: { backgroundSize: "contain", backgroundRepeat: "no-repeat" },
  tile: { backgroundSize: "auto", backgroundRepeat: "repeat" },
  center: { backgroundSize: "auto", backgroundRepeat: "no-repeat" },
};

function useImageUrl(fileName: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileName) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    invoke<ArrayBuffer>("background_image_read", { fileName })
      .then((bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes]));
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName]);
  return url;
}

/** The background image behind the whole interface, dimmed with the theme's root color. */
export function BackgroundLayer({ theme }: { theme: Theme }) {
  const settings = useSettingsStore((s) => s.background);
  const url = useImageUrl(settings.image);
  if (!url) return null;

  const blur = clampBlur(settings.blur);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          ...(FIT_STYLES[settings.fit] ?? FIT_STYLES.cover),
          backgroundImage: `url("${url}")`,
          backgroundPosition: settings.position,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          // Hides the soft edge the blur leaves at the window border.
          transform: blur > 0 ? "scale(1.05)" : undefined,
        }}
      />
      {/* The opaque root color; --bg-root itself turns translucent with transparency. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: resolveValue(theme.tokens.colors.background.root, theme.tokens),
          opacity: clampDim(settings.dim) / 100,
        }}
      />
    </div>
  );
}
