import { describe, expect, it, vi } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";

vi.mock("../terminal/runner", () => ({
  disposeTerminal: vi.fn(),
  getTerminalCliSessionId: (sessionId: string) => (sessionId === "live" ? "reported-0001" : null),
}));

const { canShowAsChat, canShowInTerminal } = await import("./switchAgentView");

const claude: CLIManifest = {
  id: "anthropic-claude",
  name: "Claude Code",
  description: "",
  install_cmd: "",
  command: "claude",
  supports_sessions: true,
  uses_acp: true,
  offers_terminal: true,
  native_rules_files: [],
};

describe("canShowAsChat", () => {
  it("needs a CLI terminal with a known conversation and ACP", () => {
    const terminal = { kind: "terminal" as const, cliProviderId: "anthropic-claude" };
    expect(canShowAsChat({ ...terminal, id: "live" }, claude)).toBe(true);
    expect(canShowAsChat({ ...terminal, id: "x", cliSessionId: "stored-00001" }, claude)).toBe(
      true,
    );
    expect(canShowAsChat({ ...terminal, id: "x" }, claude)).toBe(false);
    expect(canShowAsChat({ ...terminal, id: "live" }, { ...claude, uses_acp: false })).toBe(false);
    expect(canShowAsChat({ id: "live", kind: "terminal", cliProviderId: "shell" }, claude)).toBe(
      false,
    );
  });
});

describe("canShowInTerminal", () => {
  it("needs a chat whose conversation the CLI can resume in a terminal", () => {
    const chat = {
      id: "c",
      kind: "agent" as const,
      cliProviderId: "anthropic-claude",
      cliSessionId: "d46ec595-b288-433a-85fc-6f5a76c52d86",
    };
    expect(canShowInTerminal(chat, claude)).toBe(true);
    expect(canShowInTerminal({ ...chat, cliSessionId: undefined }, claude)).toBe(false);
    expect(canShowInTerminal({ ...chat, kind: "terminal" }, claude)).toBe(false);
    expect(canShowInTerminal(chat, { ...claude, offers_terminal: false })).toBe(false);
  });
});
