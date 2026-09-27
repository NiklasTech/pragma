import { describe, expect, it } from "vite-plus/test";

import {
  currentModelName,
  pendingPreferences,
  sortConfigOptions,
  type AcpConfigOption,
} from "./sessionOptions";

function option(
  id: string,
  category: string | null,
  currentValue: string,
  values: string[],
): AcpConfigOption {
  return {
    id,
    name: id,
    description: null,
    category,
    currentValue,
    options: values.map((value) => ({ value, name: `${value} name`, description: null })),
  };
}

const model = option("model", "model", "opus", ["opus", "sonnet"]);
const effort = option("effort", "thought_level", "high", ["low", "high"]);
const mode = option("mode", "mode", "default", ["default", "plan"]);

describe("sortConfigOptions", () => {
  it("puts the model first, then effort and mode", () => {
    expect(sortConfigOptions([mode, effort, model]).map((item) => item.id)).toEqual([
      "model",
      "effort",
      "mode",
    ]);
  });
});

describe("currentModelName", () => {
  it("returns the display name of the selected model", () => {
    expect(currentModelName([effort, model])).toBe("opus name");
  });

  it("returns null when the CLI reports no model option", () => {
    expect(currentModelName([effort])).toBeNull();
  });
});

describe("pendingPreferences", () => {
  it("returns remembered values the session offers but does not use yet", () => {
    expect(
      pendingPreferences([model, effort], { model: "sonnet", effort: "high", mode: "plan" }),
    ).toEqual([{ configId: "model", value: "sonnet" }]);
  });

  it("skips values the CLI no longer offers", () => {
    expect(pendingPreferences([model], { model: "retired-model" })).toEqual([]);
  });
});
