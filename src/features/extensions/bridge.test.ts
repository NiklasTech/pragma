import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
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

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

function makeContext(sent: string[] = [], workspaceRoot: string | null = null): BridgeContext {
  return {
    extensionId: "test-ext",
    workspaceRoot,
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
    invokeMock.mockReset();
    useCommandPaletteStore.setState({ commands: [], isOpen: false });
    useSettingsStore.setState({ extensions: {} });
    useExtensionsStore.setState({ panels: [], summaries: [], statuses: {}, workspaceRoot: null });
    useEditorStore.setState({ tabs: [], activeTabId: null, cursorPositions: {} });
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

  it("reads workspace files through the confined workspace command", async () => {
    invokeMock.mockResolvedValue({ path: "/ws/a.txt", name: "a.txt", content: "hi" });
    const result = await handleBridgeRequest(makeContext([], "/ws"), {
      kind: "request",
      id: 1,
      method: "workspace.readFile",
      params: { path: "a.txt" },
    });
    expect(invokeMock).toHaveBeenCalledWith("extension_workspace_read_file", {
      workspaceRoot: "/ws",
      path: "a.txt",
    });
    expect(result).toEqual({ path: "/ws/a.txt", name: "a.txt", content: "hi" });
  });

  it("writes workspace files through the confined workspace command", async () => {
    invokeMock.mockResolvedValue(undefined);
    await handleBridgeRequest(makeContext([], "/ws"), {
      kind: "request",
      id: 1,
      method: "workspace.writeFile",
      params: { path: "a.txt", content: "" },
    });
    expect(invokeMock).toHaveBeenCalledWith("extension_workspace_write_file", {
      workspaceRoot: "/ws",
      path: "a.txt",
      content: "",
    });
  });

  it("maps workspace.list entries to camelCase", async () => {
    invokeMock.mockResolvedValue([
      { path: "/ws/src", name: "src", is_directory: true, is_file: false },
    ]);
    const result = await handleBridgeRequest(makeContext([], "/ws"), {
      kind: "request",
      id: 1,
      method: "workspace.list",
      params: {},
    });
    expect(invokeMock).toHaveBeenCalledWith("extension_workspace_list", {
      workspaceRoot: "/ws",
      path: ".",
    });
    expect(result).toEqual([{ path: "/ws/src", name: "src", isDirectory: true }]);
  });

  it("rejects workspace access without an open workspace", async () => {
    await expect(
      handleBridgeRequest(makeContext(), {
        kind: "request",
        id: 1,
        method: "workspace.readFile",
        params: { path: "a.txt" },
      }),
    ).rejects.toThrow("No workspace is open");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("rejects workspace requests with invalid params", async () => {
    const ctx = makeContext([], "/ws");
    await expect(
      handleBridgeRequest(ctx, {
        kind: "request",
        id: 1,
        method: "workspace.readFile",
        params: {},
      }),
    ).rejects.toThrow('"path"');
    await expect(
      handleBridgeRequest(ctx, {
        kind: "request",
        id: 2,
        method: "workspace.writeFile",
        params: { path: "a.txt", content: 5 },
      }),
    ).rejects.toThrow('"content"');
    await expect(
      handleBridgeRequest(ctx, {
        kind: "request",
        id: 3,
        method: "workspace.list",
        params: "nope",
      }),
    ).rejects.toThrow("params must be an object");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("reads and replaces the active editor text", async () => {
    useEditorStore.setState({
      tabs: [
        {
          id: "f1",
          kind: "file",
          path: "/repo/a.ts",
          name: "a.ts",
          content: "before",
          originalContent: "before",
          isModified: false,
        },
      ],
      activeTabId: "f1",
    });

    expect(
      await handleBridgeRequest(makeContext(), {
        kind: "request",
        id: 1,
        method: "editor.getText",
      }),
    ).toBe("before");

    await handleBridgeRequest(makeContext(), {
      kind: "request",
      id: 2,
      method: "editor.setText",
      params: { text: "after" },
    });

    const tab = useEditorStore.getState().tabs[0];
    expect(tab?.kind === "file" ? tab.content : null).toBe("after");
    expect(tab?.kind === "file" ? tab.isModified : false).toBe(true);
  });

  it("allows setting the active editor text to an empty string", async () => {
    useEditorStore.setState({
      tabs: [
        {
          id: "f1",
          kind: "file",
          path: "/repo/a.ts",
          name: "a.ts",
          content: "before",
          originalContent: "before",
          isModified: false,
        },
      ],
      activeTabId: "f1",
    });
    await handleBridgeRequest(makeContext(), {
      kind: "request",
      id: 1,
      method: "editor.setText",
      params: { text: "" },
    });
    const tab = useEditorStore.getState().tabs[0];
    expect(tab?.kind === "file" ? tab.content : null).toBe("");
  });

  it("returns the active editor selection from the cursor position", async () => {
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
        },
      ],
      activeTabId: "f1",
      cursorPositions: { f1: { line: 7, column: 3 } },
    });
    expect(
      await handleBridgeRequest(makeContext(), {
        kind: "request",
        id: 1,
        method: "editor.getSelection",
      }),
    ).toEqual({ line: 7, column: 3 });
  });

  it("rejects editor writes without an active editor", async () => {
    await expect(
      handleBridgeRequest(makeContext(), {
        kind: "request",
        id: 1,
        method: "editor.setText",
        params: { text: "x" },
      }),
    ).rejects.toThrow("No active editor");
  });

  it("rejects unknown methods", async () => {
    await expect(
      handleBridgeRequest(makeContext(), { kind: "request", id: 1, method: "fs.read" }),
    ).rejects.toThrow("Unknown method");
  });
});
