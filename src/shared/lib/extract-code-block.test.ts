import { describe, expect, it } from "vite-plus/test";

import { extractFirstCodeBlock } from "./extract-code-block";

describe("extractFirstCodeBlock", () => {
  it("returns null when no code block is present", () => {
    expect(extractFirstCodeBlock("Just some text.")).toBeNull();
  });

  it("extracts a code block without language", () => {
    const result = extractFirstCodeBlock("```\nconst x = 1;\n```");
    expect(result).toEqual({ code: "const x = 1;" });
  });

  it("extracts a code block with language", () => {
    const result = extractFirstCodeBlock("```typescript\nconst x: number = 1;\n```");
    expect(result).toEqual({ language: "typescript", code: "const x: number = 1;" });
  });

  it("trims trailing whitespace from the code", () => {
    const result = extractFirstCodeBlock("```\nconst x = 1;\n\n```");
    expect(result).toEqual({ code: "const x = 1;" });
  });

  it("returns the first code block when multiple are present", () => {
    const markdown = "```js\nconst a = 1;\n```\n\n```js\nconst b = 2;\n```";
    const result = extractFirstCodeBlock(markdown);
    expect(result).toEqual({ language: "js", code: "const a = 1;" });
  });
});
