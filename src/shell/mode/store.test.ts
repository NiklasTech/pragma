import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const persisted = new Map<string, string>();

vi.stubGlobal("window", {
  localStorage: {
    getItem: (name: string) => persisted.get(name) ?? null,
    setItem: (name: string, value: string) => {
      persisted.set(name, value);
    },
    removeItem: (name: string) => {
      persisted.delete(name);
    },
  },
});

const { resolveUiMode, UI_MODE_STORAGE_KEY, useUiModeStore } = await import("./store");

describe("ui mode store", () => {
  beforeEach(() => {
    persisted.clear();
    useUiModeStore.setState({ uiMode: null });
  });

  it("defaults to agents without a workspace and editor with one", () => {
    expect(resolveUiMode(null, false)).toBe("agents");
    expect(resolveUiMode(null, true)).toBe("editor");
  });

  it("keeps an explicit mode over the workspace default", () => {
    expect(resolveUiMode("agents", true)).toBe("agents");
    expect(resolveUiMode("editor", false)).toBe("editor");
  });

  it("persists the selected mode under pragma.ui.mode", () => {
    useUiModeStore.getState().setUiMode("editor");

    expect(useUiModeStore.getState().uiMode).toBe("editor");

    const raw = persisted.get(UI_MODE_STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? "")).toMatchObject({ state: { uiMode: "editor" } });
  });

  it("toggles between the two modes", () => {
    useUiModeStore.getState().toggleUiMode("agents");
    expect(useUiModeStore.getState().uiMode).toBe("editor");

    useUiModeStore.getState().toggleUiMode("editor");
    expect(useUiModeStore.getState().uiMode).toBe("agents");
  });
});
