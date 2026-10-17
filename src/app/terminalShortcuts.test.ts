import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const layout = vi.hoisted(() => ({
  terminal: { mode: "docked-bottom" as "docked-bottom" | "hidden" },
  toggleTerminal: vi.fn(),
}));
const explorer = vi.hoisted(() => ({ rootPath: null as string | null }));

vi.mock("@/shell/layout", () => ({ useLayoutStore: { getState: () => layout } }));
vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: { getState: () => explorer },
}));

vi.stubGlobal("window", {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});

const { useUiModeStore } = await import("@/shell/mode");
const { leaveAgentsForTerminal, toggleTerminalFromShortcut } = await import("./terminalShortcuts");

describe("terminal shortcuts", () => {
  beforeEach(() => {
    layout.terminal.mode = "docked-bottom";
    layout.toggleTerminal.mockClear();
    explorer.rootPath = null;
    useUiModeStore.setState({ uiMode: null });
  });

  it("shows the editor without hiding its terminal when no folder is open", () => {
    toggleTerminalFromShortcut();
    expect(useUiModeStore.getState().uiMode).toBe("editor");
    expect(layout.toggleTerminal).not.toHaveBeenCalled();
  });

  it("shows the editor and opens a hidden terminal from the Agents workspace", () => {
    explorer.rootPath = "/repo";
    useUiModeStore.setState({ uiMode: "agents" });
    layout.terminal.mode = "hidden";
    toggleTerminalFromShortcut();
    expect(useUiModeStore.getState().uiMode).toBe("editor");
    expect(layout.toggleTerminal).toHaveBeenCalledOnce();
  });

  it("toggles the terminal in the editor", () => {
    useUiModeStore.setState({ uiMode: "editor" });
    toggleTerminalFromShortcut();
    expect(layout.toggleTerminal).toHaveBeenCalledOnce();
    expect(leaveAgentsForTerminal()).toBe(false);
  });
});
