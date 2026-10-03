import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";

import { buildExtensionSrcDoc } from "./sdkBootstrap";

interface FakeWindow {
  parent: { postMessage: (message: unknown) => void };
  addEventListener: (
    type: string,
    listener: (event: { source: unknown; data: unknown }) => void,
  ) => void;
  pragma?: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
}

/// Runs the bootstrap script of the srcdoc against a fake iframe window.
function bootSdk() {
  const posted: Record<string, unknown>[] = [];
  let onMessage: ((event: { source: unknown; data: unknown }) => void) | null = null;
  const parent = {
    postMessage: (message: unknown) => posted.push(message as Record<string, unknown>),
  };
  const fakeWindow: FakeWindow = {
    parent,
    addEventListener: (_type, listener) => {
      onMessage = listener;
    },
  };
  const srcDoc = buildExtensionSrcDoc("");
  const script = /<script>([\s\S]*?)<\/script>/.exec(srcDoc)?.[1] ?? "";
  runInNewContext(script, { window: fakeWindow, setTimeout, clearTimeout });
  const deliver = (data: unknown) => onMessage?.({ source: parent, data });
  return { sdk: fakeWindow.pragma, posted, deliver };
}

describe("extension SDK bootstrap", () => {
  it("registers a tool and answers host calls with its handler", async () => {
    const { sdk, posted, deliver } = bootSdk();
    expect(sdk).toBeDefined();
    const registration = sdk?.agent.registerTool(
      { name: "count", description: "Count", inputSchema: { type: "object" } },
      (input: unknown) => (input as { text: string }).text.split(" ").length,
    );
    const request = posted[0];
    expect(request).toMatchObject({ kind: "request", method: "agent.registerTool" });
    deliver({ kind: "response", id: request?.id, ok: true, result: null });
    await registration;

    deliver({
      kind: "call",
      id: 7,
      method: "tool.call",
      params: { name: "count", input: { text: "a b c" } },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posted[posted.length - 1]).toEqual({ kind: "result", id: 7, ok: true, result: 3 });
  });

  it("reports calls without a handler as errors", async () => {
    const { posted, deliver } = bootSdk();
    deliver({ kind: "call", id: 3, method: "diagnostics.provide", params: { providerId: "x" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posted[posted.length - 1]).toMatchObject({ kind: "result", id: 3, ok: false });
  });
});
