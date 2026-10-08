import { describe, expect, it } from "vite-plus/test";

import type { UIMessage } from "ai";

import { createCompactionMessage, isCompactionMessage } from "@/shared/lib/ai/compaction";

import { insertSummary, planSummary, renderTranscript } from "./plan";
import { estimateTokens, prunedOutputPlaceholder, pruneToolOutputs } from "./prune";

function text(id: string, role: UIMessage["role"], content: string): UIMessage {
  return { id, role, parts: [{ type: "text", text: content }] };
}

function toolStep(id: string, outputs: unknown[]): UIMessage {
  return {
    id,
    role: "assistant",
    parts: outputs.map((output, index) => ({
      type: "dynamic-tool" as const,
      toolName: "read_file",
      toolCallId: `${id}-${index}`,
      state: "output-available" as const,
      input: { path: `file-${index}.ts` },
      output,
    })),
  };
}

function outputs(message: UIMessage): unknown[] {
  return message.parts.map((part) => (part.type === "dynamic-tool" ? part.output : undefined));
}

describe("pruneToolOutputs", () => {
  it("replaces large old outputs and keeps the recent and small ones", () => {
    const large = "x".repeat(5000);
    const messages = [
      text("1", "user", "read everything"),
      toolStep("2", [large, "small", large]),
      toolStep("3", [large, large, large, large, large, large]),
    ];

    const result = pruneToolOutputs(messages);

    expect(outputs(result.messages[1])).toEqual([
      prunedOutputPlaceholder(5000),
      "small",
      prunedOutputPlaceholder(5000),
    ]);
    expect(outputs(result.messages[2])).toEqual(Array(6).fill(large));
    expect(result.messages[2]).toBe(messages[2]);
    expect(result.removedChars).toBe(2 * (5000 - prunedOutputPlaceholder(5000).length));
  });

  it("changes nothing when there is nothing to prune", () => {
    const messages = [text("1", "user", "hi"), toolStep("2", ["x".repeat(5000)])];
    expect(pruneToolOutputs(messages)).toEqual({ messages, removedChars: 0 });
  });
});

describe("estimateTokens", () => {
  it("counts text and tool payloads at four characters per token", () => {
    expect(estimateTokens([text("1", "user", "x".repeat(400))])).toBe(100);
    expect(estimateTokens([toolStep("2", ["y".repeat(400)])])).toBeGreaterThan(100);
  });

  it("counts a tool image at a fixed size instead of its base64 length", () => {
    const screenshot = {
      text: "Screenshot",
      images: [{ mediaType: "image/png", data: "A".repeat(400_000) }],
    };
    const tokens = estimateTokens([toolStep("2", [screenshot])]);
    expect(tokens).toBeGreaterThan(1500);
    expect(tokens).toBeLessThan(2000);
  });
});

describe("pruneToolOutputs with images", () => {
  it("replaces old screenshots with a placeholder", () => {
    const screenshot = { text: "Screenshot", images: [{ mediaType: "image/png", data: "aGk=" }] };
    const result = pruneToolOutputs([
      toolStep("1", [screenshot]),
      toolStep("2", ["a", "b", "c", "d", "e", "f"]),
    ]);
    expect(outputs(result.messages[0])[0]).toEqual(expect.stringContaining("removed"));
  });
});

describe("planSummary", () => {
  it("needs at least two turns", () => {
    expect(planSummary([text("1", "user", "hi"), text("2", "assistant", "hello")])).toBeNull();
  });

  it("keeps the last two turns and summarizes the rest", () => {
    const messages = [
      text("1", "user", "a"),
      text("2", "assistant", "b"),
      text("3", "user", "c"),
      text("4", "assistant", "d"),
      text("5", "user", "e"),
      text("6", "assistant", "f"),
    ];

    const plan = planSummary(messages);

    expect(plan?.cutIndex).toBe(2);
    expect(plan?.older.map((message) => message.id)).toEqual(["1", "2"]);
    expect(plan?.previousSummary).toBeNull();
  });

  it("starts after the previous summary and carries it over", () => {
    const messages = [
      text("1", "user", "a"),
      createCompactionMessage("earlier summary", "s1"),
      text("2", "user", "b"),
      text("3", "assistant", "c"),
      text("4", "user", "d"),
    ];

    const plan = planSummary(messages);

    expect(plan?.cutIndex).toBe(4);
    expect(plan?.older.map((message) => message.id)).toEqual(["2", "3"]);
    expect(plan?.previousSummary).toBe("earlier summary");
    expect(renderTranscript(plan!, 10_000)).toContain("earlier summary");
  });

  it("inserts the summary before the kept turns", () => {
    const messages = [text("1", "user", "a"), text("2", "assistant", "b"), text("3", "user", "c")];
    const next = insertSummary(messages, 2, "summary");
    expect(next.map((message) => message.id).slice(0, 2)).toEqual(["1", "2"]);
    expect(isCompactionMessage(next[2])).toBe(true);
    expect(next[3].id).toBe("3");
  });
});

describe("renderTranscript", () => {
  it("clips tool payloads and keeps the newest part within the budget", () => {
    const plan = {
      previousSummary: null,
      older: [text("1", "user", "first"), toolStep("2", ["z".repeat(4000)])],
      cutIndex: 2,
    };

    const full = renderTranscript(plan, 100_000);
    expect(full).toContain("User: first");
    expect(full).toContain("Tool call read_file");
    expect(full).toContain("more characters]");

    const short = renderTranscript(plan, 200);
    expect(short.startsWith("[Earlier messages omitted]")).toBe(true);
    expect(short).not.toContain("User: first");
  });
});
