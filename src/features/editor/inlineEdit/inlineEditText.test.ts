import { Text } from "@codemirror/state";
import { describe, expect, it } from "vite-plus/test";

import { changeSummary, inlineEditModel, wholeLineRange } from "./inlineEditText";

const doc = Text.of(["one", "two", "three", "four"]);

describe("wholeLineRange", () => {
  it("covers the cursor's line when nothing is selected", () => {
    expect(wholeLineRange(doc, 5, 5)).toEqual({ from: 4, to: 7 });
  });

  it("widens a selection to whole lines", () => {
    expect(wholeLineRange(doc, 1, 9)).toEqual({ from: 0, to: 13 });
  });

  it("leaves out a line the selection only touches at its start", () => {
    expect(wholeLineRange(doc, 0, 8)).toEqual({ from: 0, to: 7 });
  });
});

describe("changeSummary", () => {
  it("names how the line count changes", () => {
    expect(changeSummary("a\nb\nc\nd", "a\nb")).toBe("4 lines become 2");
    expect(changeSummary("a\nb", "x\ny")).toBe("2 lines change");
    expect(changeSummary("a", "")).toBe("Removes 1 line");
    expect(changeSummary("a", "a")).toBe("Nothing to change");
  });
});

describe("inlineEditModel", () => {
  const base = {
    activeProvider: "anthropic" as const,
    activeModel: "claude-sonnet",
    providers: {
      anthropic: { model: "claude-sonnet" },
      custom: { model: "m" },
      ollama: { model: "m" },
    } as Parameters<typeof inlineEditModel>[0]["providers"],
    apiKeyRefs: { anthropic: null } as Parameters<typeof inlineEditModel>[0]["apiKeyRefs"],
  };

  it("needs a stored key for a hosted provider", () => {
    expect(inlineEditModel(base)).toBeNull();
    const withKey = { ...base, apiKeyRefs: { ...base.apiKeyRefs, anthropic: "ref" } };
    expect(inlineEditModel(withKey)).toEqual({ provider: "anthropic", model: "claude-sonnet" });
  });

  it("runs Ollama without a key", () => {
    expect(
      inlineEditModel({ ...base, activeProvider: "ollama", activeModel: "llama" })?.model,
    ).toBe("llama");
  });
});
