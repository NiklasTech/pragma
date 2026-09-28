import { describe, expect, it } from "vite-plus/test";
import { droppedDeadKeyText } from "./terminal-dead-keys";

describe("droppedDeadKeyText", () => {
  it("returns the character typed after a cancelled dead key", () => {
    expect(droppedDeadKeyText("~", "~/")).toBe("/");
  });

  it("ignores keypresses without a preceding composition", () => {
    expect(droppedDeadKeyText(null, "~/")).toBeNull();
  });

  it("ignores a composed character such as ã", () => {
    expect(droppedDeadKeyText("ã", "ã")).toBeNull();
  });

  it("ignores keys that do not continue the committed text", () => {
    expect(droppedDeadKeyText("~", "ab")).toBeNull();
  });
});
