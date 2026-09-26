import { describe, expect, it } from "vite-plus/test";

import { decideTerminalStop } from "./stop";

describe("decideTerminalStop", () => {
  it("interrupts the first time", () => {
    expect(decideTerminalStop(null, 1_000)).toBe("interrupt");
  });

  it("kills when the second press lands within two seconds", () => {
    expect(decideTerminalStop(1_000, 2_999)).toBe("kill");
  });

  it("interrupts again once the window has passed", () => {
    expect(decideTerminalStop(1_000, 3_000)).toBe("interrupt");
  });
});
