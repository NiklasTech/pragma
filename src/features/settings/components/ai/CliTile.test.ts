import { describe, expect, it } from "vite-plus/test";

import type { CLIStatus } from "@/shared/stores/ai";

import { statusLine } from "./CliTile";

function status(patch: Partial<CLIStatus>): CLIStatus {
  return {
    provider_id: "x",
    installed: true,
    version: null,
    authenticated: true,
    user: null,
    error: null,
    ...patch,
  };
}

describe("statusLine", () => {
  it("says what is missing first", () => {
    expect(statusLine(undefined)).toBe("Not installed");
    expect(statusLine(status({ installed: false }))).toBe("Not installed");
    expect(statusLine(status({ authenticated: false }))).toBe("Not signed in");
  });

  it("names the account, else the bare version number", () => {
    expect(statusLine(status({ user: "me@example.com" }))).toBe("Signed in as me@example.com");
    expect(statusLine(status({ version: "2.1.326 (Claude Code)" }))).toBe("Version 2.1.326");
    expect(statusLine(status({ version: "grok 1.0.62 (build abc)" }))).toBe("Version 1.0.62");
    expect(statusLine(status({ version: "0.2.2-rc.1" }))).toBe("Version 0.2.2-rc.1");
    expect(statusLine(status({}))).toBe("Ready");
  });
});
