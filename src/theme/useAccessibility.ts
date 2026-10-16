import { useEffect, useState } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { effectiveReduceMotion, isReduceMotionSetting } from "./accessibility";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches)
  );
}

function setFlag(name: string, on: boolean): void {
  if (on) document.documentElement.setAttribute(name, "");
  else document.documentElement.removeAttribute(name);
}

/** Marks the document for reduced motion, focus outlines and color blind status markers. */
export function useAccessibility(): void {
  const setting = useSettingsStore((s) => s.appearance.reduceMotion);
  const alwaysShowFocus = useSettingsStore((s) => s.appearance.alwaysShowFocus);
  const colorBlindStatus = useSettingsStore((s) => s.appearance.colorBlindStatus);
  const [systemPrefers, setSystemPrefers] = useState(systemPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setSystemPrefers(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const reduceMotion = effectiveReduceMotion(
    isReduceMotionSetting(setting) ? setting : "system",
    systemPrefers,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    setFlag("data-reduce-motion", reduceMotion);
    setFlag("data-focus-always", alwaysShowFocus);
    setFlag("data-colorblind-status", colorBlindStatus);
  }, [reduceMotion, alwaysShowFocus, colorBlindStatus]);
}
