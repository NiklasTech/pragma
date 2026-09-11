import { describe, expect, it } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";

import { isAcpActive } from "./acp";

function manifest(id: string, usesAcp: boolean): CLIManifest {
  return {
    id,
    name: id,
    description: "",
    supports_sessions: true,
    uses_acp: usesAcp,
  };
}

describe("isAcpActive", () => {
  it("is driven by the active manifest instead of a hardcoded provider id", () => {
    const manifests = [manifest("openai-codex", true)];
    expect(isAcpActive(manifests, "openai-codex", true)).toBe(true);
  });

  it("keeps Kimi active from its manifest", () => {
    const manifests = [manifest("moonshot-kimi", true)];
    expect(isAcpActive(manifests, "moonshot-kimi", true)).toBe(true);
  });

  it("returns false when the experimental toggle is off", () => {
    const manifests = [manifest("openai-codex", true)];
    expect(isAcpActive(manifests, "openai-codex", false)).toBe(false);
  });

  it("returns false for a CLI manifest that does not speak ACP", () => {
    const manifests = [manifest("some-cli", false)];
    expect(isAcpActive(manifests, "some-cli", true)).toBe(false);
  });

  it("returns false when no CLI provider is active", () => {
    const manifests = [manifest("moonshot-kimi", true)];
    expect(isAcpActive(manifests, null, true)).toBe(false);
  });

  it("returns false when the active CLI manifest is unknown", () => {
    expect(isAcpActive([], "openai-codex", true)).toBe(false);
  });
});
