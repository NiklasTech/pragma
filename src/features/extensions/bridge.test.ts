import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  handleBridgeRequest,
  parseBridgeRequest,
  prefixedCommandId,
  type BridgeContext,
} from "./bridge";
import { useExtensionsStore } from "./store";

function makeContext(sent: string[] = []): BridgeContext {
  return {
    extensionId: "test-ext",
    sendCommand: (commandId) => {
      sent.push(commandId);
    },
  };
}

describe("parseBridgeRequest", () => {
  it("accepts a well-formed request", () => {
    const request = parseBridgeRequest({ kind: "request", id: 1, method: "settings.get" });
    expect(request).toEqual({ kind: "request", id: 1, method: "settings.get" });
  });

  it("keeps params when present", () => {
    const request = parseBridgeRequest({
      kind: "request",
      id: 2,
      method: "notifications.show",
      params: { message: "hi" },
    });
    expect(request?.params).toEqual({ message: "hi" });
  });

  it("rejects malformed messages", () => {
    expect(parseBridgeRequest(null)).toBeNull();
    expect(parseBridgeRequest("request")).toBeNull();
    expect(parseBridgeRequest({ kind: "response", id: 1, method: "x" })).toBeNull();
    expect(parseBridgeRequest({ kind: "request", id: 1.5, method: "x" })).toBeNull();
    expect(parseBridgeRequest({ kind: "request", id: 1, method: "" })).toBeNull();
    expect(parseBridgeRequest({ kind: "request", id: "1", method: "x" })).toBeNull();
  });
});

describe("handleBridgeRequest", () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ commands: [], isOpen: false });
    useSettingsStore.setState({ extensions: {} });
    useExtensionsStore.setState({ panels: [], summaries: [], statuses: {} });
  });

  it("registers a command with a prefixed id and forwards execution", async () => {
    const sent: string[] = [];
    await handleBridgeRequest(makeContext(sent), {
      kind: "request",
      id: 1,
      method: "commands.register",
      params: { id: "hello", title: "Say Hello" },
    });

    const commands = useCommandPaletteStore.getState().commands;
    expect(commands).toHaveLength(1);
    expect(commands[0]?.id).toBe(prefixedCommandId("test-ext", "hello"));
    expect(commands[0]?.category).toBe("Extensions");

    commands[0]?.action();
    expect(sent).toEqual(["hello"]);
  });

  it("unregisters a command", async () => {
    const ctx = makeContext();
    await handleBridgeRequest(ctx, {
      kind: "request",
      id: 1,
      method: "commands.register",
      params: { id: "hello", title: "Say Hello" },
    });
    await handleBridgeRequest(ctx, {
      kind: "request",
      id: 2,
      method: "commands.unregister",
      params: { id: "hello" },
    });
    expect(useCommandPaletteStore.getState().commands).toHaveLength(0);
  });

  it("rejects commands.register without a title", async () => {
    await expect(
      handleBridgeRequest(makeContext(), {
        kind: "request",
        id: 1,
        method: "commands.register",
        params: { id: "hello" },
      }),
    ).rejects.toThrow('"title"');
  });

  it("round-trips extension settings through the settings store", async () => {
    const ctx = makeContext();
    expect(await handleBridgeRequest(ctx, { kind: "request", id: 1, method: "settings.get" })).toBe(
      null,
    );

    await handleBridgeRequest(ctx, {
      kind: "request",
      id: 2,
      method: "settings.set",
      params: { value: { runs: 3 } },
    });

    expect(useSettingsStore.getState().extensions["test-ext"]).toEqual({
      enabled: true,
      settings: { runs: 3 },
    });
    expect(
      await handleBridgeRequest(ctx, { kind: "request", id: 3, method: "settings.get" }),
    ).toEqual({ runs: 3 });
  });

  it("registers and replaces panels", async () => {
    const ctx = makeContext();
    await handleBridgeRequest(ctx, {
      kind: "request",
      id: 1,
      method: "panels.register",
      params: { id: "a", title: "Panel A", html: "<p>a</p>" },
    });
    await handleBridgeRequest(ctx, {
      kind: "request",
      id: 2,
      method: "panels.register",
      params: { id: "a", title: "Panel A2" },
    });

    const panels = useExtensionsStore.getState().panels;
    expect(panels).toHaveLength(1);
    expect(panels[0]?.title).toBe("Panel A2");
    expect(panels[0]?.extensionId).toBe("test-ext");
  });

  it("rejects notifications.show without a message", async () => {
    await expect(
      handleBridgeRequest(makeContext(), {
        kind: "request",
        id: 1,
        method: "notifications.show",
        params: {},
      }),
    ).rejects.toThrow('"message"');
  });

  it("returns null from editor.getActiveFile without an active tab", async () => {
    useEditorStore.setState({ tabs: [], activeTabId: null });
    const result = await handleBridgeRequest(makeContext(), {
      kind: "request",
      id: 1,
      method: "editor.getActiveFile",
    });
    expect(result).toBeNull();
  });

  it("returns the active file from editor.getActiveFile", async () => {
    useEditorStore.setState({
      tabs: [
        {
          id: "f1",
          kind: "file",
          path: "/repo/a.ts",
          name: "a.ts",
          content: "",
          originalContent: "",
          isModified: false,
          language: "typescript",
        },
      ],
      activeTabId: "f1",
      cursorPositions: { f1: { line: 4, column: 2 } },
    });
    const result = await handleBridgeRequest(makeContext(), {
      kind: "request",
      id: 1,
      method: "editor.getActiveFile",
    });
    expect(result).toEqual({
      path: "/repo/a.ts",
      name: "a.ts",
      language: "typescript",
      cursor: { line: 4, column: 2 },
    });
  });

  it("rejects unknown methods", async () => {
    await expect(
      handleBridgeRequest(makeContext(), { kind: "request", id: 1, method: "fs.read" }),
    ).rejects.toThrow("Unknown method");
  });
});
