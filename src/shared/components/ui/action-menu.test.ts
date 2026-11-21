import { describe, expect, it } from "vite-plus/test";

import { actionForKey, type ActionMenuSpec } from "./action-menu";

const noop = () => {};

const spec: ActionMenuSpec = {
  head: "file.ts",
  groups: [
    { items: [{ key: "c", label: "copy", onSelect: noop, disabled: true }] },
    {
      items: [
        { key: "v", label: "paste", onSelect: noop },
        { key: "c", label: "copy path", onSelect: noop },
      ],
    },
  ],
};

describe("actionForKey", () => {
  it("runs the first enabled action of a letter, ignoring case", () => {
    expect(actionForKey(spec, "C")?.label).toBe("copy path");
    expect(actionForKey(spec, "v")?.label).toBe("paste");
    expect(actionForKey(spec, "z")).toBeNull();
  });
});
