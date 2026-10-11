import { describe, expect, it } from "vite-plus/test";

import { useAIStore } from "@/shared/stores/ai";

import { engineCanChat, pinnedSessionEngine } from "./sessionEngine";

describe("pinnedSessionEngine", () => {
  it("returns the pinned engine", () => {
    const engine = { kind: "builtin" as const, provider: "custom" as const, model: "qwen" };
    expect(pinnedSessionEngine({ kind: "agent", agentEngine: engine })).toBe(engine);
  });

  it("pins the CLI of an older coding CLI conversation", () => {
    expect(pinnedSessionEngine({ kind: "agent", cliProviderId: "claude-code" })).toEqual({
      kind: "cli",
      cliProviderId: "claude-code",
    });
  });

  it("leaves terminal and unpinned sessions on the global selection", () => {
    expect(pinnedSessionEngine({ kind: "terminal", cliProviderId: "claude-code" })).toBeNull();
    expect(pinnedSessionEngine({ kind: "agent" })).toBeNull();
    expect(pinnedSessionEngine(undefined)).toBeNull();
  });
});

describe("engineCanChat", () => {
  const engine = { cliProviderId: null, provider: "anthropic" as const, model: "m", baseUrl: "" };
  const auth = {
    apiKeyRefs: { ...useAIStore.getState().apiKeyRefs, anthropic: null },
    cliStatuses: {},
    copilotAuth: { authenticated: false },
  };

  it("needs a key for a hosted provider", () => {
    expect(engineCanChat(engine, auth)).toBe(false);
    expect(
      engineCanChat(engine, { ...auth, apiKeyRefs: { ...auth.apiKeyRefs, anthropic: "ref" } }),
    ).toBe(true);
  });

  it("needs a signed-in coding CLI", () => {
    const cli = { ...engine, cliProviderId: "claude-code" };
    const status = {
      provider_id: "claude-code",
      installed: true,
      version: null,
      authenticated: true,
      user: null,
      error: null,
    };
    expect(engineCanChat(cli, auth)).toBe(false);
    expect(engineCanChat(cli, { ...auth, cliStatuses: { "claude-code": status } })).toBe(true);
  });
});
