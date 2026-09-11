import { describe, expect, it } from "vite-plus/test";
import { resolvePanelActiveSessionId } from "./terminal-panels";

describe("resolvePanelActiveSessionId", () => {
  it("uses the stored id when it still belongs to the panel", () => {
    expect(resolvePanelActiveSessionId(["a", "b"], "a")).toBe("a");
  });

  it("falls back to the last session when the stored id is stale", () => {
    expect(resolvePanelActiveSessionId(["a", "b"], "missing")).toBe("b");
  });

  it("returns null when the panel has no sessions", () => {
    expect(resolvePanelActiveSessionId([], "a")).toBeNull();
  });
});
