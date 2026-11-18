import { useEffect, useState } from "react";

import { useSettingsStore } from "@/shared/stores/settings";

import { effectiveReduceMotion, isReduceMotionSetting } from "./accessibility";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches)
  );
}

/** Whether motion is reduced: the Pragma setting, or the system when it is set to follow. */
export function useReducedMotion(): boolean {
  const setting = useSettingsStore((s) => s.appearance.reduceMotion);
  const [systemPrefers, setSystemPrefers] = useState(systemPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setSystemPrefers(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return effectiveReduceMotion(isReduceMotionSetting(setting) ? setting : "system", systemPrefers);
}

/** The same answer outside React, read from the flag `useAccessibility` sets on the document. */
export function isMotionReduced(): boolean {
  return (
    typeof document !== "undefined" && document.documentElement.hasAttribute("data-reduce-motion")
  );
}
