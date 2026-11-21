import { describe, expect, it } from "vite-plus/test";

import { MAX_PANES } from "../panes/operations";
import { clampAgentCount } from "./AgentCountStepper";

describe("clampAgentCount", () => {
  it("keeps the count between one and the panes of a tab", () => {
    expect(clampAgentCount(0)).toBe(1);
    expect(clampAgentCount(3)).toBe(3);
    expect(clampAgentCount(MAX_PANES + 1)).toBe(MAX_PANES);
  });
});
