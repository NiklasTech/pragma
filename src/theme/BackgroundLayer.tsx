import { useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useSettingsStore } from "@/shared/stores/settings";
import { clampBlur, clampDim, measureImageTones, type BackgroundFit } from "./background";
import { useBackgroundImageStore } from "./backgroundImage";
import { resolveValue } from "./tokenResolution";
import type { Theme } from "./types";

const FIT_STYLES: Record<BackgroundFit, CSSProperties> = {
  cover: { backgroundSize: "cover", backgroundRepeat: "no-repeat" },
  contain: { backgroundSize: "contain", backgroundRepeat: "no-repeat" },
  tile: { backgroundSize: "auto", backgroundRepeat: "repeat" },
  center: { backgroundSize: "auto", backgroundRepeat: "no-repeat" },
};

const SAMPLE_SIZE = 64;

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// WebKit may not render a blob in CSS without a media type.
function imageType(fileName: string): string {
  return IMAGE_TYPES[fileName.split(".").pop()?.toLowerCase() ?? ""] ?? "image/png";
}

/** Downscales the image and measures its darkest and lightest tones. */
function measureTones(url: string): Promise<ReturnType<typeof measureImageTones>> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      resolve(measureImageTones(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data));
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function useImageUrl(fileName: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileName) {
      setUrl(null);
      useBackgroundImageStore.getState().setTones(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    invoke<ArrayBuffer>("background_image_read", { fileName })
      .then(async (bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: imageType(fileName) }));
        setUrl(objectUrl);
        const tones = await measureTones(objectUrl);
        if (!cancelled) useBackgroundImageStore.getState().setTones(tones);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setUrl(null);
        toast.error("Could not show the background image", { description: String(err) });
      });
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
