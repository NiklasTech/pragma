import type { ParakeetModel, WhisperModel } from "@/shared/stores/settings";

export interface VoiceModelOption<Id extends string> {
  id: Id;
  label: string;
  summary: string;
  /** Peak memory while transcribing, measured on a 15 s clip. */
  memoryMb: number;
  /** Installed memory from which this model is the recommended pick. */
  recommendedFromGb: number;
}

const GIGABYTE = 1024 ** 3;

// Smallest first: `recommendedVoiceModel` walks the list and keeps the last model that fits.
export const PARAKEET_MODELS: readonly VoiceModelOption<ParakeetModel>[] = [
  {
    id: "parakeet-v3-compact",
    label: "Parakeet V3 Compact",
    summary:
      "4-bit weights. German and English stay as accurate as the full model; some other languages lose a little.",
    memoryMb: 900,
    recommendedFromGb: 0,
  },
  {
    id: "parakeet-v3",
    label: "Parakeet V3",
    summary: "8-bit weights. Full accuracy in all 25 languages.",
    memoryMb: 1400,
    recommendedFromGb: 12,
  },
];

export const WHISPER_MODELS: readonly VoiceModelOption<WhisperModel>[] = [
  {
    id: "large-v3-turbo-q5_0",
    label: "Whisper Large V3 Turbo",
    summary:
      "The most accurate local model, but on the processor it takes about as long as the recording. Parakeet is much faster.",
    memoryMb: 900,
    recommendedFromGb: 0,
  },
];

export function recommendedVoiceModel<Id extends string>(
  models: readonly VoiceModelOption<Id>[],
  memoryBytes: number | null,
): Id | null {
  if (memoryBytes === null || models.length === 0) return null;
  let pick = models[0].id;
  for (const model of models) {
    if (memoryBytes >= model.recommendedFromGb * GIGABYTE) pick = model.id;
  }
  return pick;
}
