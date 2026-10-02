import { describe, expect, it } from "vite-plus/test";

import { PARAKEET_MODELS, WHISPER_MODELS, recommendedVoiceModel } from "./voiceModels";

const GB = 1024 ** 3;

describe("recommendedVoiceModel", () => {
  it("recommends the compact model on machines with little memory", () => {
    expect(recommendedVoiceModel(PARAKEET_MODELS, 8 * GB)).toBe("parakeet-v3-compact");
  });

  it("recommends the most accurate model that fits", () => {
    expect(recommendedVoiceModel(PARAKEET_MODELS, 16 * GB)).toBe("parakeet-v3");
    expect(recommendedVoiceModel(WHISPER_MODELS, 4 * GB)).toBe("large-v3-turbo-q5_0");
  });

  it("recommends nothing while the memory is unknown", () => {
    expect(recommendedVoiceModel(PARAKEET_MODELS, null)).toBeNull();
  });

  it("lists every catalog smallest first", () => {
    for (const models of [PARAKEET_MODELS, WHISPER_MODELS]) {
      const thresholds = models.map((model) => model.recommendedFromGb);
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    }
  });
});
