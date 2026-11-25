import { describe, expect, it } from "vite-plus/test";

import { errorText } from "./errorText";

describe("errorText", () => {
  it("drops class names, protocol names and codes", () => {
    expect(errorText(new Error("file not found"))).toBe("file not found");
    expect(errorText("Error: ACP JSON-RPC error -32603: Internal error: quota")).toBe(
      "Internal error: quota",
    );
    expect(errorText("io error: Permission denied (os error 13)")).toBe("Permission denied");
    expect(errorText("JSON-RPC error (-32001)")).toBe("Something went wrong.");
  });

  it("says in words what a timeout or a closed agent means", () => {
    expect(errorText("ACP request timed out")).toBe("The agent did not answer in time.");
    expect(errorText(new Error("ACP connection closed"))).toBe("The agent stopped.");
  });

  it("falls back for values that carry no message", () => {
    expect(errorText(undefined)).toBe("Something went wrong.");
    expect(errorText({}, "Could not save.")).toBe("Could not save.");
  });
});
