import { Text } from "@codemirror/state";
import { describe, expect, it } from "vite-plus/test";

import { diffRegion, locatePrediction } from "./next-edit-diff";

describe("next edit diff", () => {
  it("finds the changed region widened to whole words", () => {
    expect(diffRegion("const count = 1;", "const total = 1;")).toEqual({
      offset: 6,
      removed: "count",
      inserted: "total",
    });
    expect(diffRegion("call(a)", "call(a, b)")).toEqual({
      offset: 6,
      removed: "",
      inserted: ", b",
    });
    expect(diffRegion("let count = 1;", "let counter = 1;")).toEqual({
      offset: 4,
      removed: "count",
      inserted: "counter",
    });
    expect(diffRegion("same", "same")).toBeNull();
  });

  it("locates a prediction near its line but never on the cursor line", () => {
    const doc = Text.of(["let count = 1;", "log(count);", "", "use(count);"]);
    expect(locatePrediction(doc, { line: 2, find: "count", replace: "total" }, 1)).toEqual({
      from: 19,
      to: 24,
    });
    expect(locatePrediction(doc, { line: 3, find: "use(count)", replace: "x" }, 1)?.from).toBe(
      doc.line(4).from,
    );
    expect(locatePrediction(doc, { line: 1, find: "count", replace: "total" }, 1)?.from).toBe(19);
    expect(locatePrediction(doc, { line: 2, find: "missing", replace: "x" }, 1)).toBeNull();
  });
});
