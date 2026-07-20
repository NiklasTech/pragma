import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  computeSingleChange,
  flushLspDocumentSync,
  getLspDocumentSentContent,
  isLspDocumentSynced,
  markLspDocumentSynced,
  unmarkLspDocument,
} from "./lspDocuments";

const FILE = "C:/project/src/a.ts";

function createInvokeRecorder() {
  const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  const invokeFn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    calls.push({ cmd, args });
    return null;
  });
  return { calls, invokeFn };
}

describe("lspDocuments sync tracking", () => {
  beforeEach(() => {
    unmarkLspDocument(FILE);
  });

  it("remembers the content sent with didOpen", () => {
    markLspDocumentSynced(FILE, "initial");
    expect(isLspDocumentSynced(FILE)).toBe(true);
    expect(getLspDocumentSentContent(FILE)).toBe("initial");
  });

  it("clears content tracking on unmark", () => {
    markLspDocumentSynced(FILE, "initial");
    unmarkLspDocument(FILE);
    expect(isLspDocumentSynced(FILE)).toBe(false);
    expect(getLspDocumentSentContent(FILE)).toBeUndefined();
  });
});

describe("computeSingleChange", () => {
  it("returns null for identical text", () => {
    expect(computeSingleChange("same", "same")).toBeNull();
  });

  it("detects an append at the end", () => {
    expect(computeSingleChange("ab", "abc")).toEqual({
      range: { start: { line: 0, character: 2 }, end: { line: 0, character: 2 } },
      text: "c",
    });
  });

  it("detects an insertion in the middle", () => {
    expect(computeSingleChange("ac", "abc")).toEqual({
      range: { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } },
      text: "b",
    });
  });

  it("detects a deletion", () => {
    expect(computeSingleChange("abc", "ac")).toEqual({
      range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
      text: "",
    });
  });

  it("detects a full replacement", () => {
    expect(computeSingleChange("aaa", "bbb")).toEqual({
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
      text: "bbb",
    });
  });

  it("computes line-aware positions across newlines", () => {
    expect(computeSingleChange("a\nb", "a\nxb")).toEqual({
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
      text: "x",
    });
  });

  it("does not let prefix and suffix overlap", () => {
    expect(computeSingleChange("aa", "aaa")).toEqual({
      range: { start: { line: 0, character: 2 }, end: { line: 0, character: 2 } },
      text: "a",
    });
  });
});

describe("flushLspDocumentSync", () => {
  beforeEach(() => {
    unmarkLspDocument(FILE);
  });

  it("does nothing when the document was never synced", async () => {
    const { calls, invokeFn } = createInvokeRecorder();
    await flushLspDocumentSync("typescript", FILE, "content", invokeFn);
    expect(calls).toEqual([]);
  });

  it("sends changed content via lsp_did_change", async () => {
    markLspDocumentSynced(FILE, "old");
    const { calls, invokeFn } = createInvokeRecorder();

    await flushLspDocumentSync("typescript", FILE, "new", invokeFn);

    expect(calls).toEqual([
      {
        cmd: "lsp_did_change",
        args: {
          language: "typescript",
          filePath: FILE,
          content: "new",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
          changeText: "new",
        },
      },
    ]);
    expect(getLspDocumentSentContent(FILE)).toBe("new");
  });

  it("skips the request when content is unchanged", async () => {
    markLspDocumentSynced(FILE, "same");
    const { calls, invokeFn } = createInvokeRecorder();

    await flushLspDocumentSync("typescript", FILE, "same", invokeFn);

    expect(calls).toEqual([]);
  });

  it("serializes concurrent flushes so the latest content wins", async () => {
    markLspDocumentSynced(FILE, "v0");
    const order: string[] = [];
    const invokeFn = vi.fn(async (_cmd: string, args?: Record<string, unknown>) => {
      const content = args?.content as string;
      await new Promise((resolve) => setTimeout(resolve, content === "v1" ? 20 : 1));
      order.push(content);
      return null;
    });

    await Promise.all([
      flushLspDocumentSync("typescript", FILE, "v1", invokeFn),
      flushLspDocumentSync("typescript", FILE, "v2", invokeFn),
    ]);

    expect(order).toEqual(["v1", "v2"]);
    expect(getLspDocumentSentContent(FILE)).toBe("v2");
  });
});
