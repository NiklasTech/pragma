import { describe, expect, it } from "vite-plus/test";

import { quotePathForShell, quotePathsForShell } from "./shellQuote";

describe("quotePathForShell", () => {
  it("uses POSIX single quotes for Unix shells", () => {
    expect(quotePathForShell("/tmp/it's here", "/bin/zsh")).toBe("'/tmp/it'\\''s here'");
  });

  it("doubles single quotes for PowerShell", () => {
    expect(quotePathForShell("C:\\it's here", "C:\\Program Files\\PowerShell\\7\\pwsh.exe")).toBe(
      "'C:\\it''s here'",
    );
  });

  it("uses double quotes for cmd", () => {
    expect(quotePathForShell("C:\\my dir", "C:\\Windows\\System32\\cmd.exe")).toBe('"C:\\my dir"');
  });
});

describe("quotePathsForShell", () => {
  it("joins paths with a trailing space", () => {
    expect(quotePathsForShell(["/a b", "/c"], "/bin/bash")).toBe("'/a b' '/c' ");
  });
});
