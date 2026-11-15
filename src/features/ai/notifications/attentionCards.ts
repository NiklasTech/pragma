import { create } from "zustand";

import type { AttentionKind } from "./activity";

export interface AttentionCardItem {
  sessionId: string;
  kind: AttentionKind;
  at: number;
}

interface AttentionCardsState {
  /** Oldest first; one card per session, the latest event wins. */
  cards: AttentionCardItem[];
  push: (sessionId: string, kind: AttentionKind) => void;
  dismiss: (sessionId: string) => void;
}

export const useAttentionCardsStore = create<AttentionCardsState>()((set) => ({
  cards: [],
  push: (sessionId, kind) =>
    set((state) => ({
      cards: [
        ...state.cards.filter((card) => card.sessionId !== sessionId),
        { sessionId, kind, at: Date.now() },
      ],
    })),
  dismiss: (sessionId) =>
    set((state) =>
      state.cards.some((card) => card.sessionId === sessionId)
        ? { cards: state.cards.filter((card) => card.sessionId !== sessionId) }
        : state,
    ),
}));

let audio: AudioContext | null = null;

/// A short, soft two-note tone; it needs no sound file and respects the system volume.
export function playAttentionTone(): void {
  try {
    audio ??= new AudioContext();
    const start = audio.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.11, 1320],
    ] as const) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(0.08, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.2);
    }
  } catch {
    // Without audio output the card still shows.
  }
}
