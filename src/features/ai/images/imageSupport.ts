import type { AIProvider, ModelInfo } from "@/shared/stores/ai";

export type ImageInputSupport = { supported: true } | { supported: false; reason: string };

// OpenAI chat models that predate image input.
const OPENAI_TEXT_ONLY = /^(gpt-3\.5|gpt-4(-\d{4})?$|gpt-4-32k|o1-mini|o3-mini)/;

/** Whether an API model accepts image parts; only providers whose requests carry images count. */
export function apiModelAcceptsImages(
  provider: AIProvider,
  model: string,
  models: ModelInfo[] | undefined,
): boolean {
  switch (provider) {
    case "anthropic":
    case "gemini":
      return true;
    case "openai":
      return !OPENAI_TEXT_ONLY.test(model);
    case "openrouter":
      return models?.find((info) => info.id === model)?.supports_vision === true;
    default:
      return false;
  }
}

export interface ImageEngine {
  cliProviderId: string | null;
  acpActive: boolean;
  /** What the ACP agent advertised; null while its session has not started. */
  acpAcceptsImages: boolean | null;
  provider: AIProvider;
  model: string;
  models: ModelInfo[] | undefined;
}

const CLI_REASON = "This coding CLI does not accept images.";

export function imageInputSupport(engine: ImageEngine): ImageInputSupport {
  if (engine.cliProviderId) {
    if (!engine.acpActive) return { supported: false, reason: CLI_REASON };
    if (engine.acpAcceptsImages === null) {
      return { supported: false, reason: "Images are available once the coding CLI has started." };
    }
    return engine.acpAcceptsImages ? { supported: true } : { supported: false, reason: CLI_REASON };
  }
  return apiModelAcceptsImages(engine.provider, engine.model, engine.models)
    ? { supported: true }
    : { supported: false, reason: "The selected model does not accept images." };
}
