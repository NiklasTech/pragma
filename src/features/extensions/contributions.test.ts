import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useProblemsStore } from "@/shared/stores/problems";
import type { AgentSettings } from "@/shared/stores/settings";

import {
  extensionToolDefinitions,
  extensionToolName,
  findExtensionTool,
  resolveExtensionToolApproval,
} from "./agentTools";
import { handleBridgeRequest, type BridgeContext } from "./bridge";
import { callExtension, handleCallResult, rejectCallsFor, setCallPoster } from "./calls";
import { validateCompletionItems } from "./completion";
import { extensionSource, validateDiagnostics } from "./diagnostics";
import { validateExtensionManifest } from "./manifest";
import { useExtensionsStore } from "./store";

const ctx: BridgeContext = { extensionId: "demo", workspaceRoot: "/ws", sendCommand: () => {} };

function request(method: string, params?: unknown) {
  return handleBridgeRequest(ctx, { kind: "request", id: 1, method, params });
}

describe("contribution bridge methods", () => {
  beforeEach(() => {
    useExtensionsStore.getState().reset();
  });

  it("sets, replaces and removes status bar items", async () => {
    await request("statusBar.set", { id: "words", text: "12 words", command: "count" });
    await request("statusBar.set", { id: "words", text: "13 words", alignment: "left" });
    expect(useExtensionsStore.getState().statusBarItems).toEqual([
      {
        extensionId: "demo",
        id: "words",
        text: "13 words",
        tooltip: undefined,
        command: undefined,
        alignment: "left",
      },
    ]);
    await request("statusBar.remove", { id: "words" });
    expect(useExtensionsStore.getState().statusBarItems).toEqual([]);
  });

  it("rejects invalid status bar items", async () => {
    await expect(request("statusBar.set", { id: "a b", text: "x" })).rejects.toThrow();
    await expect(
      request("statusBar.set", { id: "a", text: "x", alignment: "top" }),
    ).rejects.toThrow();
  });

  it("registers keybindings with valid keys only", async () => {
    await request("keybindings.register", {
      command: "count",
      key: "ctrl+alt+w",
      mac: "cmd+alt+w",
    });
    expect(useExtensionsStore.getState().keybindings).toHaveLength(1);
    await expect(request("keybindings.register", { command: "x", key: "w" })).rejects.toThrow(
      /Invalid key/,
    );
    await request("keybindings.unregister", { command: "count" });
    expect(useExtensionsStore.getState().keybindings).toHaveLength(0);
  });

  it("registers language providers per language", async () => {
    await request("languages.registerDiagnosticsProvider", { id: "d1", language: "markdown" });
    await request("languages.registerCompletionProvider", {
      id: "c1",
      language: "*",
      triggerCharacters: [":"],
    });
    const state = useExtensionsStore.getState();
    expect(state.diagnosticsProviders[0]).toMatchObject({ id: "d1", language: "markdown" });
    expect(state.completionProviders[0]).toMatchObject({ id: "c1", triggerCharacters: [":"] });
    await expect(
      request("languages.registerCompletionProvider", { id: "c2", language: "Mark Down" }),
    ).rejects.toThrow();
    await request("languages.unregisterProvider", { id: "d1" });
    expect(useExtensionsStore.getState().diagnosticsProviders).toEqual([]);
  });

  it("registers agent tools with an object schema", async () => {
    await request("agent.registerTool", {
      name: "count_words",
      description: "Counts words",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
      readOnly: true,
    });
    expect(useExtensionsStore.getState().agentTools[0]).toMatchObject({
      name: "count_words",
      readOnly: true,
    });
    await expect(
      request("agent.registerTool", {
        name: "bad name",
        description: "x",
        inputSchema: { type: "object" },
      }),
    ).rejects.toThrow();
    await expect(
      request("agent.registerTool", {
        name: "x",
        description: "x",
        inputSchema: { type: "string" },
      }),
    ).rejects.toThrow();
  });

  it("only writes to terminals the extension created", async () => {
    await expect(request("terminal.sendText", { id: "other", text: "ls" })).rejects.toThrow(
      /Unknown terminal/,
    );
  });
});

describe("host to extension calls", () => {
  it("resolves calls with the extension's result and ignores other extensions", async () => {
    const posted: unknown[] = [];
    setCallPoster((_id, message) => {
      posted.push(message);
      return true;
    });
    const pending = callExtension("demo", "tool.call", { name: "x" }, 1000);
    const { id } = posted[0] as { id: number };
    expect(handleCallResult("intruder", { kind: "result", id, ok: true, result: "no" })).toBe(true);
    handleCallResult("demo", { kind: "result", id, ok: true, result: 42 });
    await expect(pending).resolves.toBe(42);
    expect(handleCallResult("demo", { kind: "request", id: 1 })).toBe(false);
  });

  it("rejects calls when the extension stops or is not running", async () => {
    setCallPoster(() => true);
    const pending = callExtension("demo", "tool.call", {}, 1000);
    rejectCallsFor("demo");
    await expect(pending).rejects.toThrow(/stopped/);
    setCallPoster(() => false);
    await expect(callExtension("demo", "tool.call", {}, 1000)).rejects.toThrow(/not running/);
  });
});

describe("agent tools", () => {
  const tool = {
    extensionId: "demo",
    name: "count",
    description: "Count",
    inputSchema: { type: "object" },
    readOnly: false,
  };

  it("names and finds tools", () => {
    expect(extensionToolName("demo", "count")).toBe("ext__demo__count");
    expect(findExtensionTool("ext__demo__count", [tool])).toBe(tool);
    expect(findExtensionTool("agent_read_file", [tool])).toBeUndefined();
    expect(extensionToolDefinitions([tool])[0]?.function.name).toBe("ext__demo__count");
  });

  it("skips tools whose full name is too long for provider APIs", () => {
    const long = { ...tool, extensionId: "x".repeat(40), name: "y".repeat(30) };
    expect(extensionToolDefinitions([long])).toEqual([]);
  });

  it("follows the approval settings of built-in tools", () => {
    const settings: AgentSettings = {
      enabled: true,
      autoApprove: "edits",
      allowedCommands: [],
      stepLimit: null,
      useProjectRules: true,
    };
    expect(resolveExtensionToolApproval(tool, settings, false)).toBe("required");
    expect(resolveExtensionToolApproval({ readOnly: true }, settings, false)).toBe("auto");
    expect(resolveExtensionToolApproval(tool, settings, true)).toBe("auto");
    expect(resolveExtensionToolApproval(tool, { ...settings, autoApprove: "all" }, false)).toBe(
      "auto",
    );
  });
});

describe("provider answers", () => {
  it("keeps valid diagnostics and drops malformed ones", () => {
    const problems = validateDiagnostics(
      [
        { line: 2, column: 3, message: "Too long", severity: "error", endColumn: 9 },
        { line: 0, message: "bad line" },
        { line: 4, message: "" },
        { line: 5, message: "defaults" },
      ],
      "/ws/a.md",
      "demo",
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatchObject({ severity: "error", endColumn: 9, source: "ext:demo" });
    expect(problems[1]).toMatchObject({ column: 1, severity: "warning" });
  });

  it("keeps extension diagnostics when LSP diagnostics update", () => {
    const store = useProblemsStore.getState();
    store.clearProblems();
    store.setSourceDiagnostics("/ws/a.md", extensionSource("demo"), [
      ...validateDiagnostics([{ line: 1, message: "ext" }], "/ws/a.md", "demo"),
    ]);
    store.setFileDiagnostics("/ws/a.md", []);
    expect(useProblemsStore.getState().problems).toHaveLength(1);
    store.clearSourceDiagnostics(extensionSource("demo"));
    expect(useProblemsStore.getState().problems).toHaveLength(0);
  });

  it("keeps valid completion items", () => {
    expect(
      validateCompletionItems([
        { label: "hello", insertText: "hello()", kind: "function" },
        { label: "" },
        { label: "x", kind: "unknown-kind" },
      ]),
    ).toEqual([{ label: "hello", insertText: "hello()", kind: "function" }, { label: "x" }]);
  });
});

describe("manifest keybindings", () => {
  it("parses keybinding contributions", () => {
    const result = validateExtensionManifest({
      format: "pragma-extension-v1",
      id: "demo",
      name: "Demo",
      version: "1.0.0",
      contributes: { keybindings: [{ command: "count", key: "ctrl+alt+w", mac: "cmd+alt+w" }] },
    });
    expect(result.valid).toBe(true);
    expect(result.manifest?.contributes?.keybindings).toEqual([
      { command: "count", key: "ctrl+alt+w", mac: "cmd+alt+w" },
    ]);
    expect(
      validateExtensionManifest({
        format: "pragma-extension-v1",
        id: "demo",
        name: "Demo",
        version: "1.0.0",
        contributes: { keybindings: [{ key: "ctrl+w" }] },
      }).valid,
    ).toBe(false);
  });
});
