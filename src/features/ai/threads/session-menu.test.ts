import { describe, expect, it } from "vite-plus/test";

import type { CLIManifest, CLIStatus } from "@/shared/stores/ai";

import { buildSessionMenuCliRows } from "./session-menu";

function manifest(id: string, usesAcp: boolean): CLIManifest {
  return {
    id,
    name: id,
    description: "",
    install_cmd: `npm install -g ${id}`,
    command: id,
    supports_sessions: true,
    uses_acp: usesAcp,
    offers_terminal: true,
  };
}

function status(providerId: string, installed: boolean): CLIStatus {
  return {
    provider_id: providerId,
    installed,
    version: installed ? "1.0.0" : null,
    authenticated: installed,
    user: null,
    error: null,
  };
}

describe("buildSessionMenuCliRows", () => {
  it("shows the install command as a disabled row hint when the CLI is missing", () => {
    const rows = buildSessionMenuCliRows([manifest("openai-codex", true)], {});
    expect(rows[0].disabled).toBe(true);
    expect(rows[0].hint).toBe("npm install -g openai-codex");
    expect(rows[0].items).toEqual([]);
  });

  it("treats installed false as missing", () => {
    const rows = buildSessionMenuCliRows([manifest("openai-codex", true)], {
      "openai-codex": status("openai-codex", false),
    });
    expect(rows[0].disabled).toBe(true);
  });

  it("exposes Conversation and Terminal for an installed ACP CLI", () => {
    const rows = buildSessionMenuCliRows([manifest("openai-codex", true)], {
      "openai-codex": status("openai-codex", true),
    });
    expect(rows[0].disabled).toBe(false);
    expect(rows[0].items.map((item) => item.label)).toEqual(["Conversation", "Terminal"]);
  });

  it("exposes only Conversation when the CLI has no terminal", () => {
    const rows = buildSessionMenuCliRows(
      [{ ...manifest("deepseek-harness", true), offers_terminal: false }],
      { "deepseek-harness": status("deepseek-harness", true) },
    );
    expect(rows[0].items.map((item) => item.label)).toEqual(["Conversation"]);
  });

  it("exposes only Terminal for an installed non-ACP CLI", () => {
    const rows = buildSessionMenuCliRows([manifest("plain-cli", false)], {
      "plain-cli": status("plain-cli", true),
    });
    expect(rows[0].items.map((item) => item.label)).toEqual(["Terminal"]);
  });
});
