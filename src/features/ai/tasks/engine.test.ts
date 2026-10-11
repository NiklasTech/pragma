import { describe, expect, it } from "vite-plus/test";

import { useAIStore, type CLIManifest, type CLIStatus } from "@/shared/stores/ai";

import { pickTaskEngine, type TaskEngineState } from "./engine";

const claude: CLIManifest = {
  id: "claude-code",
  name: "Claude Code",
  description: "",
  install_cmd: "",
  command: "claude",
  supports_sessions: true,
  uses_acp: true,
  offers_terminal: true,
};

function status(authenticated: boolean): CLIStatus {
  return {
    provider_id: "claude-code",
    installed: true,
    version: null,
    authenticated,
    user: null,
    error: null,
  };
}

function state(overrides: Partial<TaskEngineState> = {}): TaskEngineState {
  const base = useAIStore.getState();
  return {
    activeCLIProvider: null,
    activeProvider: "anthropic",
    activeModel: "model",
    providers: base.providers,
    apiKeyRefs: { ...base.apiKeyRefs, anthropic: null },
    cliStatuses: {},
    copilotAuth: { authenticated: false },
    cliManifests: [claude],
    ...overrides,
  };
}

describe("pickTaskEngine", () => {
  it("runs on the coding CLI selected in the chat", () => {
    const current = state({
      activeCLIProvider: "claude-code",
      cliStatuses: { "claude-code": status(true) },
    });
    expect(pickTaskEngine(undefined, current)).toEqual({
      kind: "cli",
      cliProviderId: "claude-code",
    });
  });

  it("runs on the built-in provider when it has a key", () => {
    const base = useAIStore.getState();
    const current = state({ apiKeyRefs: { ...base.apiKeyRefs, anthropic: "ref" } });
    expect(pickTaskEngine(undefined, current)).toEqual({ kind: "builtin" });
  });

  it("falls back to a signed-in coding CLI when the built-in provider has no key", () => {
    const current = state({ cliStatuses: { "claude-code": status(true) } });
    expect(pickTaskEngine(undefined, current)).toEqual({
      kind: "cli",
      cliProviderId: "claude-code",
    });
  });

  it("returns null when no engine can run", () => {
    expect(pickTaskEngine(undefined, state())).toBeNull();
    expect(
      pickTaskEngine(undefined, state({ cliStatuses: { "claude-code": status(false) } })),
    ).toBeNull();
  });

  it("keeps the assigned agent's engine and never swaps it", () => {
    const engine = { kind: "cli" as const, cliProviderId: "claude-code" };
    expect(pickTaskEngine(engine, state({ cliStatuses: { "claude-code": status(true) } }))).toBe(
      engine,
    );
    const builtin = { kind: "builtin" as const };
    expect(pickTaskEngine(builtin, state({ cliStatuses: { "claude-code": status(true) } }))).toBe(
      null,
    );
  });
});
