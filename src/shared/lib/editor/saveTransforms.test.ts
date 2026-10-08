import { describe, expect, it } from "vite-plus/test";
import { applySaveTransforms } from "./saveTransforms";

const both = { trimTrailingWhitespace: true, insertFinalNewline: true };
const none = { trimTrailingWhitespace: false, insertFinalNewline: false };

describe("applySaveTransforms", () => {
  it("leaves content unchanged when both options are off", () => {
    expect(applySaveTransforms("a  \nb\t", none)).toBe("a  \nb\t");
  });

  it("trims trailing spaces and tabs on every line", () => {
    const options = { ...none, trimTrailingWhitespace: true };
    expect(applySaveTransforms("a  \n\tb\t \n  \nc ", options)).toBe("a\n\tb\n\nc");
  });

  it("keeps CRLF line endings while trimming", () => {
    const options = { ...none, trimTrailingWhitespace: true };
    expect(applySaveTransforms("a \r\nb\t\r\n", options)).toBe("a\r\nb\r\n");
  });

  it("adds a final newline matching the file's line endings", () => {
    const options = { ...none, insertFinalNewline: true };
    expect(applySaveTransforms("a\nb", options)).toBe("a\nb\n");
    expect(applySaveTransforms("a\r\nb", options)).toBe("a\r\nb\r\n");
    expect(applySaveTransforms("a\n", options)).toBe("a\n");
    expect(applySaveTransforms("", options)).toBe("");
  });

  it("trims before adding the final newline", () => {
    expect(applySaveTransforms("a\nb  ", both)).toBe("a\nb\n");
  });
});
