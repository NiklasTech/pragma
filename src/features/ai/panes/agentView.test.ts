import { describe, expect, it } from "vite-plus/test";

import { resolveAgentView, supportsAgentView } from "./agentView";

describe("agent views", () => {
  const both = { uses_acp: true, offers_terminal: true };

  it("takes the wanted view when the CLI has it", () => {
    expect(resolveAgentView(both, "chat")).toBe("chat");
    expect(resolveAgentView(both, "terminal")).toBe("terminal");
  });

  it("falls back to the only view a CLI has", () => {
    expect(resolveAgentView({ uses_acp: false, offers_terminal: true }, "chat")).toBe("terminal");
    expect(resolveAgentView({ uses_acp: true, offers_terminal: false }, "terminal")).toBe("chat");
    expect(supportsAgentView({ uses_acp: false, offers_terminal: true }, "chat")).toBe(false);
  });
});
