import { describe, expect, it } from "vite-plus/test";

import type { ChatMessage } from "@/shared/stores/ai";

import { pullRequestBody } from "./finish";

function message(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: content, role, content, timestamp: 0 };
}

describe("pullRequestBody", () => {
  it("prefers the task notes", () => {
    expect(pullRequestBody("  Fix the login flow  ", [message("user", "prompt")])).toBe(
      "Fix the login flow",
    );
  });

  it("falls back to the first user prompt", () => {
    const messages = [
      message("system", "rules"),
      message("user", " Add a Finish menu \n"),
      message("user", "later"),
    ];
    expect(pullRequestBody(null, messages)).toBe("Add a Finish menu");
    expect(pullRequestBody("   ", messages)).toBe("Add a Finish menu");
  });

  it("is empty without notes or prompts", () => {
    expect(pullRequestBody(null, [message("assistant", "hi")])).toBe("");
  });
});
