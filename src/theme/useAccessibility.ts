import { useEffect } from "react";
import { useSettingsStore } from "@/shared/stores/settings";
import { useReducedMotion } from "./useReducedMotion";

function setFlag(name: string, on: boolean): void {
  if (on) document.documentElement.setAttribute(name, "");
  else document.documentElement.removeAttribute(name);
}

/** Marks the document for reduced motion, focus outlines and color blind status markers. */
export function useAccessibility(): void {
  const reduceMotion = useReducedMotion();
  const alwaysShowFocus = useSettingsStore((s) => s.appearance.alwaysShowFocus);
  const colorBlindStatus = useSettingsStore((s) => s.appearance.colorBlindStatus);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setFlag("data-reduce-motion", reduceMotion);
    setFlag("data-focus-always", alwaysShowFocus);
    setFlag("data-colorblind-status", colorBlindStatus);
  }, [reduceMotion, alwaysShowFocus, colorBlindStatus]);
}
