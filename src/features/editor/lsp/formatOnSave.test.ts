import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const formatMock = vi.hoisted(() => vi.fn());
const flushMock = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ lspFormatDocument: formatMock }));
vi.mock("./lspDocuments", () => ({ flushLspDocumentSync: flushMock }));

import type { LspFeatureFlags } from "./client";
import { formatForSave } from "./formatOnSave";
import { clearLspFeatureFlags, setLspFeatureFlags } from "./lspFlags";

const FILE = "/project/src/a.ts";
const OPTIONS = { tabSize: 2, insertSpaces: true };

function flags(formatting: boolean): LspFeatureFlags {
  return { formatting } as LspFeatureFlags;
}

const edit = {
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } },
  newText: "const a = 1;",
};

describe("formatForSave", () => {
  afterEach(() => {
    clearLspFeatureFlags(FILE);
    formatMock.mockReset();
    flushMock.mockReset();
  });

  it("applies the language server's edits", async () => {
    setLspFeatureFlags(FILE, flags(true));
    flushMock.mockResolvedValue(undefined);
    formatMock.mockResolvedValue([edit]);

    await expect(formatForSave("const a=1", "typescript", FILE, OPTIONS)).resolves.toBe(
      "const a = 1;",
    );
    expect(flushMock).toHaveBeenCalledWith("typescript", FILE, "const a=1");
    expect(formatMock).toHaveBeenCalledWith("typescript", FILE, 2, true);
  });

  it("keeps the content when no language server is attached", async () => {
    await expect(formatForSave("const a=1", "typescript", FILE, OPTIONS)).resolves.toBe(
      "const a=1",
    );
    expect(formatMock).not.toHaveBeenCalled();
  });

  it("keeps the content when the server cannot format", async () => {
    setLspFeatureFlags(FILE, flags(false));
    await expect(formatForSave("const a=1", "typescript", FILE, OPTIONS)).resolves.toBe(
      "const a=1",
    );
    expect(formatMock).not.toHaveBeenCalled();
  });

  it("still saves when formatting fails", async () => {
    setLspFeatureFlags(FILE, flags(true));
    flushMock.mockResolvedValue(undefined);
    formatMock.mockRejectedValue(new Error("server crashed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(formatForSave("const a=1", "typescript", FILE, OPTIONS)).resolves.toBe(
      "const a=1",
    );
  });
});
