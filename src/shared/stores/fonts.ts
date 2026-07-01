import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FontConfig, DownloadFontRequest, FontCatalogEntry } from "@/shared/lib/fonts/types";
import { installFontFaces } from "@/shared/lib/fonts/loader";

interface FontDownloadState {
  id: string;
  status: "downloading" | "done" | "error";
  error?: string;
}

interface FontState {
  fonts: FontConfig[];
  loading: boolean;
  downloads: Record<string, FontDownloadState>;
  loadFonts: () => Promise<void>;
  downloadFont: (entry: FontCatalogEntry) => Promise<void>;
  importFontFile: () => Promise<void>;
  deleteFont: (id: string) => Promise<void>;
  getFont: (id: string) => FontConfig | undefined;
}

async function refreshFontFaces(fonts: FontConfig[]) {
  installFontFaces(fonts);
}

export const useFontStore = create<FontState>((set, get) => ({
  fonts: [],
  loading: false,
  downloads: {},

  loadFonts: async () => {
    set({ loading: true });
    try {
      const fonts = await invoke<FontConfig[]>("list_fonts");
      set({ fonts });
      await refreshFontFaces(fonts);
    } finally {
      set({ loading: false });
    }
  },

  downloadFont: async (entry) => {
    set((state) => ({
      downloads: { ...state.downloads, [entry.id]: { id: entry.id, status: "downloading" } },
    }));
    try {
      const request: DownloadFontRequest = {
        id: entry.id,
        name: entry.name,
        url: entry.url,
        files: entry.files,
      };
      const config = await invoke<FontConfig>("download_font", { request });
      set((state) => ({
        fonts: [...state.fonts.filter((f) => f.id !== config.id), config],
        downloads: { ...state.downloads, [entry.id]: { id: entry.id, status: "done" } },
      }));
      await refreshFontFaces(get().fonts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        downloads: {
          ...state.downloads,
          [entry.id]: { id: entry.id, status: "error", error: message },
        },
      }));
    }
  },

  importFontFile: async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Font files", extensions: ["ttf", "otf", "woff", "woff2"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    const name = selected.split("/").pop()?.split(".")[0] ?? "custom";
    const config = await invoke<FontConfig>("import_font_file", {
      request: { name, path: selected },
    });
    set((state) => ({
      fonts: [...state.fonts.filter((f) => f.id !== config.id), config],
    }));
    await refreshFontFaces(get().fonts);
  },

  deleteFont: async (id) => {
    await invoke("delete_font", { id });
    const next = get().fonts.filter((f) => f.id !== id);
    set({ fonts: next });
    await refreshFontFaces(next);
  },

  getFont: (id) => get().fonts.find((f) => f.id === id),
}));
