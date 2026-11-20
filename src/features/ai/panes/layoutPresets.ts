import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChatSession } from "@/shared/stores/ai";

import { SHELL_PROVIDER_ID } from "../terminal/shell";
import {
  countLeaves,
  createLeaf,
  createSplit,
  createTabs,
  MAX_PANES,
  type Leaf,
  type PaneNode,
  type PaneRoot,
} from "./operations";

export const LAYOUT_PRESETS_STORAGE_KEY = "pragma.agents.layouts.v1";

/** What a pane of a saved layout starts: a shell, a coding CLI terminal, or nothing yet. */
export type PresetPane =
  | { type: "pane"; start: "shell" | "empty" }
  | { type: "pane"; start: "cli"; cliProviderId: string; cliAccountDir?: string };

export interface PresetSplit {
  type: "split";
  direction: "horizontal" | "vertical";
  sizes: number[];
  children: PresetNode[];
}

export type PresetNode = PresetPane | PresetSplit;

export interface LayoutPreset {
  id: string;
  name: string;
  layout: PresetNode;
}

function paneFor(leaf: Leaf | undefined, sessions: readonly ChatSession[]): PresetPane {
  const session = leaf?.sessionId ? sessions.find((item) => item.id === leaf.sessionId) : undefined;
  if (session?.kind !== "terminal" || !session.cliProviderId)
    return { type: "pane", start: "empty" };
  if (session.cliProviderId === SHELL_PROVIDER_ID) return { type: "pane", start: "shell" };
  const pane: PresetPane = { type: "pane", start: "cli", cliProviderId: session.cliProviderId };
  return session.cliAccountDir ? { ...pane, cliAccountDir: session.cliAccountDir } : pane;
}

/** The shape of a tab and what runs in each pane; conversations themselves are not kept. */
export function captureLayout(root: PaneRoot, sessions: readonly ChatSession[]): PresetNode | null {
  if (!root) return null;
  if (root.type === "tabs") {
    const active = root.children.find((leaf) => leaf.id === root.activeLeafId) ?? root.children[0];
    return paneFor(active, sessions);
  }
  const children = root.children
    .map((child) => captureLayout(child, sessions))
    .filter((child): child is PresetNode => child !== null);
  return { type: "split", direction: root.direction, sizes: [...root.sizes], children };
}

export function presetPaneCount(node: PresetNode): number {
  return node.type === "pane"
    ? 1
    : node.children.reduce((total, child) => total + presetPaneCount(child), 0);
}

/** Builds empty panes in the shape of a preset; returns the tree and each leaf's start. */
export function buildLayout(node: PresetNode): {
  root: PaneNode;
  starts: Array<{ leafId: string; pane: PresetPane }>;
} {
  const starts: Array<{ leafId: string; pane: PresetPane }> = [];
  const build = (current: PresetNode): PaneNode => {
    if (current.type === "pane") {
      const leaf = createLeaf(null);
      starts.push({ leafId: leaf.id, pane: current });
      return createTabs([leaf], leaf.id, `group-${leaf.id}`);
    }
    return createSplit(current.direction, current.children.map(build), current.sizes);
  };
  const root = build(node);
  return { root, starts: countLeaves(root) <= MAX_PANES ? starts : starts.slice(0, MAX_PANES) };
}

interface LayoutPresetsState {
  presets: LayoutPreset[];
  save: (name: string, layout: PresetNode) => void;
  remove: (id: string) => void;
}

export const useLayoutPresetsStore = create<LayoutPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      save: (name, layout) =>
        set((state) => ({
          presets: [...state.presets, { id: crypto.randomUUID(), name: name.trim(), layout }],
        })),
      remove: (id) =>
        set((state) => ({ presets: state.presets.filter((preset) => preset.id !== id) })),
    }),
    { name: LAYOUT_PRESETS_STORAGE_KEY, version: 1 },
  ),
);
