import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useCommandPaletteStore } from "./commandPalette";

describe("useCommandPaletteStore", () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ commands: [], isOpen: false });
  });

  it("registers a command", () => {
    const store = useCommandPaletteStore.getState();
    store.registerCommand({
      id: "test.command",
      label: "Test Command",
      category: "test",
      action: () => {},
    });

    expect(useCommandPaletteStore.getState().commands).toHaveLength(1);
    expect(useCommandPaletteStore.getState().commands[0]?.label).toBe("Test Command");
  });

  it("unregisters a command", () => {
    const store = useCommandPaletteStore.getState();
    store.registerCommand({
      id: "test.command",
      label: "Test Command",
      category: "test",
      action: () => {},
    });
    store.unregisterCommand("test.command");

    expect(useCommandPaletteStore.getState().commands).toHaveLength(0);
  });

  it("replaces an existing command with the same id", () => {
    const store = useCommandPaletteStore.getState();
    store.registerCommand({
      id: "test.command",
      label: "First",
      category: "test",
      action: () => {},
    });
    store.registerCommand({
      id: "test.command",
      label: "Second",
      category: "test",
      action: () => {},
    });

    const commands = useCommandPaletteStore.getState().commands;
    expect(commands).toHaveLength(1);
    expect(commands[0]?.label).toBe("Second");
  });

  it("preserves unrelated commands when unregistering", () => {
    const store = useCommandPaletteStore.getState();
    store.registerCommand({ id: "a", label: "A", category: "test", action: () => {} });
    store.registerCommand({ id: "b", label: "B", category: "test", action: () => {} });
    store.unregisterCommand("a");

    const commands = useCommandPaletteStore.getState().commands;
    expect(commands).toHaveLength(1);
    expect(commands[0]?.id).toBe("b");
  });

  it("opens, closes and toggles", () => {
    const store = useCommandPaletteStore.getState();

    expect(store.isOpen).toBe(false);

    store.open();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);

    store.close();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);

    store.toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);

    store.toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });
});
