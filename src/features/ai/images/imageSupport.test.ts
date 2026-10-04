import { describe, expect, it } from "vite-plus/test";

import type { ModelInfo } from "@/shared/stores/ai";

import { apiModelAcceptsImages, imageInputSupport, type ImageEngine } from "./imageSupport";

function model(id: string, supportsVision: boolean): ModelInfo {
  return { id, name: id, supports_streaming: true, supports_vision: supportsVision };
}

const apiEngine: ImageEngine = {
  cliProviderId: null,
  acpActive: false,
  acpAcceptsImages: null,
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  models: undefined,
};

describe("apiModelAcceptsImages", () => {
  it("accepts every Anthropic and Gemini model", () => {
    expect(apiModelAcceptsImages("anthropic", "claude-haiku-4-5", undefined)).toBe(true);
    expect(apiModelAcceptsImages("gemini", "gemini-2.5-pro", undefined)).toBe(true);
  });

  it("rejects OpenAI models without image input", () => {
    expect(apiModelAcceptsImages("openai", "gpt-4o", undefined)).toBe(true);
    expect(apiModelAcceptsImages("openai", "gpt-5", undefined)).toBe(true);
    expect(apiModelAcceptsImages("openai", "gpt-4-turbo", undefined)).toBe(true);
    expect(apiModelAcceptsImages("openai", "gpt-3.5-turbo", undefined)).toBe(false);
    expect(apiModelAcceptsImages("openai", "gpt-4", undefined)).toBe(false);
    expect(apiModelAcceptsImages("openai", "o3-mini", undefined)).toBe(false);
  });

  it("follows the OpenRouter model list", () => {
    const models = [model("openai/gpt-4o", true), model("deepseek/deepseek-chat", false)];
    expect(apiModelAcceptsImages("openrouter", "openai/gpt-4o", models)).toBe(true);
    expect(apiModelAcceptsImages("openrouter", "deepseek/deepseek-chat", models)).toBe(false);
    expect(apiModelAcceptsImages("openrouter", "unknown/model", models)).toBe(false);
  });

  it("rejects providers whose requests carry no images", () => {
    expect(apiModelAcceptsImages("ollama", "llava", [model("llava", true)])).toBe(false);
    expect(apiModelAcceptsImages("deepseek", "deepseek-chat", undefined)).toBe(false);
    expect(apiModelAcceptsImages("copilot", "gpt-4o", [model("gpt-4o", true)])).toBe(false);
  });
});

describe("imageInputSupport", () => {
  it("supports vision API models and explains other models", () => {
    expect(imageInputSupport(apiEngine)).toEqual({ supported: true });
    expect(imageInputSupport({ ...apiEngine, provider: "ollama", model: "llama3" })).toEqual({
      supported: false,
      reason: "The selected model does not accept images.",
    });
  });

  it("rejects coding CLIs that do not run over ACP", () => {
    expect(imageInputSupport({ ...apiEngine, cliProviderId: "codex" }).supported).toBe(false);
  });

  it("follows what the ACP agent advertised", () => {
    const acp = { ...apiEngine, cliProviderId: "claude", acpActive: true };
    expect(imageInputSupport({ ...acp, acpAcceptsImages: true })).toEqual({ supported: true });
    expect(imageInputSupport({ ...acp, acpAcceptsImages: false })).toEqual({
      supported: false,
      reason: "This coding CLI does not accept images.",
    });
    expect(imageInputSupport({ ...acp, acpAcceptsImages: null })).toEqual({
      supported: false,
      reason: "Images are available once the coding CLI has started.",
    });
  });
});
