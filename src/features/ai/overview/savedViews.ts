import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { OverviewFilter, OverviewGroup } from "./overviewModel";

export interface SavedOverviewView {
  id: string;
  name: string;
  filter: OverviewFilter;
  group: OverviewGroup;
  spaceId: string | null;
}

interface SavedViewsState {
  views: SavedOverviewView[];
  save: (view: Omit<SavedOverviewView, "id">) => void;
  remove: (id: string) => void;
}

/** Overview filters the user kept under a name, next to the built-in views. */
export const useSavedOverviewViews = create<SavedViewsState>()(
  persist(
    (set) => ({
      views: [],
      save: (view) =>
        set((state) => ({
          views: [...state.views, { ...view, id: crypto.randomUUID(), name: view.name.trim() }],
        })),
      remove: (id) => set((state) => ({ views: state.views.filter((view) => view.id !== id) })),
    }),
    { name: "pragma.agents.overviewViews.v1", version: 1 },
  ),
);
