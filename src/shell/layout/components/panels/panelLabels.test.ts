import { describe, expect, it } from "vite-plus/test";
import { panelLabel } from "./panelLabels";

describe("panelLabel", () => {
  it("labels the AI panel as AI", () => {
    expect(panelLabel("ai")).toBe("AI");
  });
});
