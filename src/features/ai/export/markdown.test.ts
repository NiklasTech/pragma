import type { UIMessage } from "@ai-sdk/react";
import { describe, expect, it } from "vite-plus/test";

import { createCompactionMessage } from "@/shared/lib/ai/compaction";

import { messageToMarkdown, sessionToMarkdown } from "./markdown";

const OFF = { includeToolOutput: false, includeReasoning: false };

function user(text: string): UIMessage {
  return { id: `u-${text}`, role: "user", parts: [{ type: "text", text }] };
}

function assistant(parts: UIMessage["parts"]): UIMessage {
  return { id: "a", role: "assistant", parts };
}

const toolPart = {
  type: "dynamic-tool",
  toolName: "read_file",
  toolCallId: "call-1",
  state: "output-available",
  input: { path: "src/main.ts" },
  output: "export const x = 1;",
} as unknown as UIMessage["parts"][number];

describe("messageToMarkdown", () => {
  it("collapses tool calls to one line with the target", () => {
    const message = assistant([toolPart, { type: "text", text: "Done." }]);
    expect(messageToMarkdown(message, OFF)).toBe("- Tool `read_file` src/main.ts\n\nDone.");
  });

  it("adds the tool output when asked", () => {
    const message = assistant([toolPart]);
    expect(messageToMarkdown(message, { ...OFF, includeToolOutput: true })).toBe(
      "- Tool `read_file` src/main.ts\n\n```\nexport const x = 1;\n```",
    );
  });

  it("leaves reasoning out unless it is included", () => {
    const message = assistant([
      { type: "reasoning", text: "Let me look.\n" },
      { type: "text", text: "<think>hidden</think>Answer" },
    ]);
    expect(messageToMarkdown(message, OFF)).toBe("Answer");
    expect(messageToMarkdown(message, { ...OFF, includeReasoning: true })).toBe(
      "> Let me look.\n> hidden\n\nAnswer",
    );
  });

  it("keeps the text of image outputs without the image data", () => {
    const screenshot = {
      text: "Screenshot of the page",
      images: [{ mediaType: "image/png", data: "aGk=" }],
    };
    const message = assistant([{ ...toolPart, output: screenshot } as UIMessage["parts"][number]]);
    const markdown = messageToMarkdown(message, { ...OFF, includeToolOutput: true });
    expect(markdown).toContain("Screenshot of the page");
    expect(markdown).not.toContain("aGk=");
  });

  it("fences output that itself contains backticks", () => {
    const message = assistant([
      { ...toolPart, output: "```ts\ncode\n```" } as UIMessage["parts"][number],
    ]);
    expect(messageToMarkdown(message, { ...OFF, includeToolOutput: true })).toContain(
      "````\n```ts\ncode\n```\n````",
    );
  });
});

describe("sessionToMarkdown", () => {
  it("writes a title and one section per turn", () => {
    const markdown = sessionToMarkdown(
      "Fix login",
      [
        createCompactionMessage("Earlier work", "c"),
        user("Why does login fail?"),
        assistant([{ type: "text", text: "The token expired." }]),
        { id: "s", role: "system", parts: [{ type: "text", text: "internal" }] },
      ],
      OFF,
    );
    expect(markdown).toBe(
      "# Fix login\n\n## Summary of earlier messages\n\nEarlier work\n\n## User\n\nWhy does login fail?\n\n## Assistant\n\nThe token expired.\n",
    );
  });

  it("skips empty turns and falls back to a default title", () => {
    expect(sessionToMarkdown(" ", [user("  ")], OFF)).toBe("# Session\n\n\n");
  });
});
