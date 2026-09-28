import { useEffect, useRef } from "react";

import { matchShortcut, type ShortcutBinding } from "@/shared/lib/shortcuts";

// Composers in mount or focus order; the last one owns the hold-to-dictate shortcut.
const owners: symbol[] = [];

function claim(owner: symbol) {
  const index = owners.indexOf(owner);
  if (index !== -1) owners.splice(index, 1);
  owners.push(owner);
}

export function releasesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (binding.code ? event.code === binding.code : event.key === binding.key) return true;
  return (
    (binding.alt === true && event.key === "Alt") ||
    (binding.ctrl === true && event.key === "Control") ||
    (binding.shift === true && event.key === "Shift") ||
    (binding.meta === true && event.key === "Meta")
  );
}

export interface UsePushToTalkOptions {
  enabled: boolean;
  binding: ShortcutBinding | null;
  start: () => void;
  stop: () => void;
}

/** Records while the shortcut is held. Returns a focus handler that makes this composer the owner. */
export function usePushToTalk({ enabled, binding, start, stop }: UsePushToTalkOptions): () => void {
  const ownerRef = useRef(Symbol("composer"));

  useEffect(() => {
    const owner = ownerRef.current;
    claim(owner);
    return () => {
      const index = owners.indexOf(owner);
      if (index !== -1) owners.splice(index, 1);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !binding) return;
    const owner = ownerRef.current;
    let holding = false;

    const release = () => {
      if (!holding) return;
      holding = false;
      stop();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (owners[owners.length - 1] !== owner || !matchShortcut(event, binding)) return;
      event.preventDefault();
      if (holding || event.repeat) return;
      holding = true;
      start();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (holding && releasesBinding(event, binding)) {
        event.preventDefault();
        release();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, [enabled, binding, start, stop]);

  return () => claim(ownerRef.current);
}
