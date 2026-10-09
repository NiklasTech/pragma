import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export interface SessionSearchHit {
  session_id: string;
  message_id: string;
  snippet: string;
}

const MIN_QUERY_CHARS = 2;
const DEBOUNCE_MS = 200;

/// Message text matches for `query`, keyed by session id; empty for short queries.
export function useTranscriptSearch(
  rootPath: string,
  query: string,
): ReadonlyMap<string, SessionSearchHit> {
  const [hits, setHits] = useState<ReadonlyMap<string, SessionSearchHit>>(() => new Map());
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_CHARS) {
      setHits(new Map());
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      invoke<SessionSearchHit[]>("ai_search_sessions", {
        req: { root_path: rootPath, query: trimmed },
      })
        .then((results) => {
          if (!cancelled) setHits(new Map(results.map((hit) => [hit.session_id, hit])));
        })
        .catch(() => {
          if (!cancelled) setHits(new Map());
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rootPath, trimmed]);

  return hits;
}

interface TranscriptJumpState {
  target: { sessionId: string; messageId: string } | null;
  jumpTo: (sessionId: string, messageId: string) => void;
  clear: () => void;
}

/// The message a search result opens; the chat scrolls to it once it is rendered.
export const useTranscriptJumpStore = create<TranscriptJumpState>()((set) => ({
  target: null,
  jumpTo: (sessionId, messageId) => set({ target: { sessionId, messageId } }),
  clear: () => set({ target: null }),
}));
