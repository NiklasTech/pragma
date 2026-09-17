import { describe, expect, it } from "vite-plus/test";

import {
  findPathHints,
  normalizeCode,
  parseFencedBlocks,
  resolveApplyTargets,
  type OpenFileTab,
} from "./applyTargets";

const openFiles: OpenFileTab[] = [
  {
    id: "tab-app",
    path: "/root/src/app.ts",
    name: "app.ts",
    content: "const value = 1;",
  },
];

describe("parseFencedBlocks", () => {
  it("captures the info string, language and code", () => {
    const blocks = parseFencedBlocks("before\n```ts src/app.ts\nconst value = 1;\n```\nafter");

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.language).toBe("ts");
    expect(blocks[0]?.info).toBe("ts src/app.ts");
    expect(blocks[0]?.code).toBe("const value = 1;");
    expect(blocks[0]?.start).toBe(7);
  });

  it("captures multiple blocks", () => {
    const blocks = parseFencedBlocks("```ts\na\n```\ntext\n```py\nb\n```");

    expect(blocks.map((block) => block.language)).toEqual(["ts", "py"]);
  });
});

describe("findPathHints", () => {
  it("finds file paths and ignores language names and versions", () => {
    expect(findPathHints("json typescript v1.2.3 src/app.ts")).toEqual(["src/app.ts"]);
    expect(findPathHints("see https://example.com/app.ts")).toEqual([]);
  });
});

describe("resolveApplyTargets", () => {
  it("resolves a path from the fence info string", () => {
    const messageText = "```ts src/app.ts\nconst value = 2;\n```";
    const targets = resolveApplyTargets({
      messageText,
      blocks: parseFencedBlocks(messageText),
      openFiles,
      activePath: null,
      rootPath: "/root",
    });

    const target = targets.get("const value = 2;");
    expect(target?.path).toBe("/root/src/app.ts");
    expect(target?.tabId).toBe("tab-app");
    expect(target?.originalCode).toBe("const value = 1;");
  });

  it("resolves a path from a leading code comment", () => {
    const messageText = "```ts\n// src/app.ts\nconst value = 2;\n```";
    const targets = resolveApplyTargets({
      messageText,
      blocks: parseFencedBlocks(messageText),
      openFiles,
      activePath: null,
      rootPath: "/root",
    });

    expect(targets.get("// src/app.ts\nconst value = 2;")?.path).toBe("/root/src/app.ts");
  });

  it("resolves a path mentioned just before the block", () => {
    const messageText = "Update **src/app.ts** like this:\n\n```ts\nconst value = 2;\n```";
    const targets = resolveApplyTargets({
      messageText,
      blocks: parseFencedBlocks(messageText),
      openFiles,
      activePath: null,
      rootPath: "/root",
    });

    expect(targets.get("const value = 2;")?.path).toBe("/root/src/app.ts");
  });

  it("falls back to the active file for a single unlabelled block", () => {
    const messageText = "```ts\nconst value = 2;\n```";
    const targets = resolveApplyTargets({
      messageText,
      blocks: parseFencedBlocks(messageText),
      openFiles: [],
      activePath: "/root/src/active.ts",
      rootPath: "/root",
    });

    expect(targets.get("const value = 2;")?.path).toBe("/root/src/active.ts");
    expect(targets.get("const value = 2;")?.tabId).toBeNull();
  });

  it("does not guess a target for multi-block replies", () => {
    const messageText = "```ts\nconst a = 1;\n```\n```ts\nconst b = 2;\n```";
    const targets = resolveApplyTargets({
      messageText,
      blocks: parseFencedBlocks(messageText),
      openFiles,
      activePath: "/root/src/app.ts",
      rootPath: "/root",
    });

    expect(targets.size).toBe(0);
  });

  it("matches a relative hint against an absolute open tab", () => {
    const messageText = "```ts\n// app.ts\nconst value = 2;\n```";
    const targets = resolveApplyTargets({
      messageText,
      blocks: parseFencedBlocks(messageText),
      openFiles,
      activePath: null,
      rootPath: "/root",
    });

    expect(targets.get("// app.ts\nconst value = 2;")?.tabId).toBe("tab-app");
  });
});

describe("normalizeCode", () => {
  it("strips a single trailing newline", () => {
    expect(normalizeCode("a\n")).toBe("a");
    expect(normalizeCode("a\n\n")).toBe("a\n");
  });
});
