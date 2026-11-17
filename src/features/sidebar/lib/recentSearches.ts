import { create } from "zustand";

const LIMIT = 6;

interface RecentSearchesState {
  queries: string[];
  remember: (query: string) => void;
}

/// The last searches that found something, newest first; kept for the running session.
export const useRecentSearches = create<RecentSearchesState>((set) => ({
  queries: [],
  remember: (query) =>
    set((state) => {
      const trimmed = query.trim();
      if (!trimmed) return state;
      return { queries: [trimmed, ...state.queries.filter((q) => q !== trimmed)].slice(0, LIMIT) };
    }),
}));
