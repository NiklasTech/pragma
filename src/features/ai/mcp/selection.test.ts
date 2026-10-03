import { describe, expect, it } from "vite-plus/test";

import { isMcpServerAllowed, mcpSelectionKey, resolveMcpServerIds } from "./selection";

describe("resolveMcpServerIds", () => {
  it("prefers the session, then the agent, then all servers", () => {
    expect(resolveMcpServerIds({ mcpServers: ["a"] }, { mcpServers: ["b"] })).toEqual(["a"]);
    expect(resolveMcpServerIds({}, { mcpServers: ["b"] })).toEqual(["b"]);
    expect(resolveMcpServerIds({}, null)).toBeNull();
    expect(resolveMcpServerIds(undefined, undefined)).toBeNull();
  });

  it("keeps an explicit empty selection", () => {
    expect(resolveMcpServerIds({ mcpServers: [] }, { mcpServers: ["b"] })).toEqual([]);
  });
});

describe("isMcpServerAllowed", () => {
  it("allows everything without a selection", () => {
    expect(isMcpServerAllowed(null, "x")).toBe(true);
    expect(isMcpServerAllowed(["a"], "x")).toBe(false);
    expect(isMcpServerAllowed(["a"], "a")).toBe(true);
  });
});

describe("mcpSelectionKey", () => {
  it("ignores order and separates all from none", () => {
    expect(mcpSelectionKey(["b", "a"])).toBe(mcpSelectionKey(["a", "b"]));
    expect(mcpSelectionKey(null)).not.toBe(mcpSelectionKey([]));
  });
});
