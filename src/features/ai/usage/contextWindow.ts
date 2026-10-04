import type { ModelListCache } from "@/shared/stores/ai";

// Context sizes by model family, for model lists that do not report one.
const MODEL_FAMILY_WINDOWS: ReadonlyArray<readonly [RegExp, number]> = [
  [/claude/i, 200_000],
  [/gpt-4\.1/i, 1_047_576],
  [/gpt-5/i, 400_000],
  [/gpt-4o|gpt-4-turbo/i, 128_000],
  [/(^|\/)o[134](-|$)/i, 200_000],
  [/gemini/i, 1_048_576],
  [/deepseek/i, 128_000],
  [/grok-4/i, 256_000],
  [/grok/i, 131_072],
  [/kimi-k2/i, 256_000],
];

export function resolveContextWindow(model: string, models?: ModelListCache): number | null {
  if (!model) return null;
  const listed = models?.models.find((item) => item.id === model)?.context_window;
  if (listed) return listed;
  return MODEL_FAMILY_WINDOWS.find(([pattern]) => pattern.test(model))?.[1] ?? null;
}

export type ContextLevel = "normal" | "warning" | "critical";

export function contextLevel(ratio: number): ContextLevel {
  if (ratio >= 0.95) return "critical";
  if (ratio >= 0.8) return "warning";
  return "normal";
}
