import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiMode = "agents" | "editor";

export const UI_MODE_STORAGE_KEY = "pragma.ui.mode";

interface UiModeState {
  uiMode: UiMode | null;
  setUiMode: (mode: UiMode) => void;
  toggleUiMode: (current: UiMode) => void;
}

/// A user who never picked a mode lands in the editor when a folder is already
/// open (CLI path / restored workspace) and in the Agents home otherwise.
export function resolveUiMode(uiMode: UiMode | null, hasRootPath: boolean): UiMode {
  if (uiMode) return uiMode;
  return hasRootPath ? "editor" : "agents";
}

export const useUiModeStore = create<UiModeState>()(
  persist(
    (set) => ({
      uiMode: null,
      setUiMode: (mode) => set({ uiMode: mode }),
      toggleUiMode: (current) => set({ uiMode: current === "agents" ? "editor" : "agents" }),
    }),
    {
      name: UI_MODE_STORAGE_KEY,
      partialize: (state) => ({ uiMode: state.uiMode }),
    },
  ),
);
