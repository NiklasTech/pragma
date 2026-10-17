import { create } from "zustand";
import type { Rgba } from "./color";

interface BackgroundImageState {
  /** Darkest and lightest tones of the loaded image, null until it is measured. */
  tones: [Rgba, Rgba] | null;
  setTones: (tones: [Rgba, Rgba] | null) => void;
}

export const useBackgroundImageStore = create<BackgroundImageState>((set) => ({
  tones: null,
  setTones: (tones) => set({ tones }),
}));
