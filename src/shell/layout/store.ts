import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DropTarget, FloatingState, FullLayoutTreeState, LayoutNode } from "./tree/types";
import {
  cleanupTree,
  createFloating,
  createPanel,
  ensureDockedPanel,
  findNode,
  moveNode,
  removeNode,
  removePanelByKind,
  setActiveTabInTabs,
  updateSplitSizes,
} from "./tree/operations";
import { layoutPresets } from "./presets";
import { useEditorStore } from "@/shared/stores/editor";

const STORAGE_KEY = "pragma.layout.v3";

const AI_DEFAULT_WIDTH = 360;
const AI_MIN_WIDTH = 260;
const AI_MAX_WIDTH = 720;

const SIDEBAR_MIN_WIDTH = 180;

const TERMINAL_MIN_HEIGHT = 20;
const TERMINAL_MAX_HEIGHT = 80;

const defaultFloating: FloatingState = {
  x: 120,
  y: 80,
  width: 420,
  height: 520,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function markCustomized(_state: FullLayoutTreeState): Partial<FullLayoutTreeState> {
  return { isCustomized: true };
}

export const useLayoutStore = create<FullLayoutTreeState>()(
  persist(
    (set) => ({
      ...layoutPresets.classic,

      // Sidebar
      setSidebarPosition: (position) =>
        set((s) => ({ sidebar: { ...s.sidebar, position }, ...markCustomized(s) })),
      setSidebarWidth: (width) =>
        set((s) => ({
          sidebar: { ...s.sidebar, width: Math.max(width, SIDEBAR_MIN_WIDTH) },
          ...markCustomized(s),
        })),
      setSidebarCollapsed: (collapsed) =>
        set((s) => ({ sidebar: { ...s.sidebar, collapsed }, ...markCustomized(s) })),
      setSidebarTab: (tab) =>
        set((s) => ({ sidebar: { ...s.sidebar, tab }, ...markCustomized(s) })),
      toggleSidebar: () =>
        set((s) => ({
          sidebar: { ...s.sidebar, collapsed: !s.sidebar.collapsed },
          ...markCustomized(s),
        })),

      // AI
      setAIMode: (mode) =>
        set((s) => {
          const prev = s.ai;
          const size = prev.mode === "floating" ? prev.floating.width : prev.size;
          return {
            ai: {
              ...prev,
              mode,
              size: clamp(size ?? AI_DEFAULT_WIDTH, AI_MIN_WIDTH, AI_MAX_WIDTH),
              floating: prev.floating ?? { ...defaultFloating },
            },
            ...markCustomized(s),
          };
        }),
      setAIFloating: (floating) =>
        set((s) => ({
          ai: { ...s.ai, floating: { ...s.ai.floating, ...floating } },
          ...markCustomized(s),
        })),
      setAISize: (size) =>
        set((s) => ({
          ai: { ...s.ai, size: clamp(size, AI_MIN_WIDTH, AI_MAX_WIDTH) },
          ...markCustomized(s),
        })),
      toggleAI: () =>
        set((s) => {
          const nextMode = s.ai.mode === "hidden" ? "drawer-right" : "hidden";
          return {
            ai: {
              ...s.ai,
              mode: nextMode,
              size: clamp(s.ai.size ?? AI_DEFAULT_WIDTH, AI_MIN_WIDTH, AI_MAX_WIDTH),
            },
            ...markCustomized(s),
          };
        }),

      // Terminal
      setTerminalMode: (mode) =>
        set((s) => {
          const nextTerminal = { ...s.terminal, mode };
          let nextRoot = s.root;
          if (mode === "docked-bottom") {
            nextRoot = cleanupTree(ensureDockedPanel(s.root, "terminal"));
          } else if (mode === "hidden" || mode === "floating-tab") {
            nextRoot = cleanupTree(removePanelByKind(s.root, "terminal"));
          }
          return {
            terminal: nextTerminal,
            root: nextRoot,
            ...markCustomized(s),
          } as Partial<FullLayoutTreeState>;
        }),
      setTerminalHeight: (height) =>
        set((s) => ({
          terminal: {
            ...s.terminal,
            height: clamp(height, TERMINAL_MIN_HEIGHT, TERMINAL_MAX_HEIGHT),
          },
          ...markCustomized(s),
        })),
      setTerminalFloating: (floating) =>
        set((s) => ({
          terminal: { ...s.terminal, floating: { ...s.terminal.floating, ...floating } },
          ...markCustomized(s),
        })),
      toggleTerminal: () =>
        set((s) => {
          const nextMode = s.terminal.mode === "docked-bottom" ? "hidden" : "docked-bottom";
          const nextTerminal = { ...s.terminal, mode: nextMode };
          let nextRoot = s.root;
          if (nextMode === "docked-bottom") {
            nextRoot = cleanupTree(ensureDockedPanel(s.root, "terminal"));
          } else {
            nextRoot = cleanupTree(removePanelByKind(s.root, "terminal"));
          }
          return {
            terminal: nextTerminal,
            root: nextRoot,
            ...markCustomized(s),
          } as Partial<FullLayoutTreeState>;
        }),

      // Tree
      setRoot: (root) => set((s) => ({ root: cleanupTree(root), ...markCustomized(s) })),
      movePanel: (panelId, target) =>
        set((s) => {
          if (target.zone === "floating") {
            const panel = findNode(s.root, panelId);
            if (!panel || panel.type !== "panel") return s;
            const cleaned = removeNode(s.root, panelId) ?? createPanel("welcome");
            const floating = createFloating(panel, {
              x: s.ai.floating?.x ?? 120,
              y: s.ai.floating?.y ?? 80,
              width: 420,
              height: 520,
            });
            return {
              root: cleanupTree(cleaned),
              floating: [...s.floating, floating],
              ...markCustomized(s),
            };
          }
          return { root: cleanupTree(moveNode(s.root, panelId, target)), ...markCustomized(s) };
        }),
      splitPanel: (panelId, direction, kind) =>
        set((s) => {
          const panel = findNode(s.root, panelId);
          if (!panel || panel.type !== "panel") return s;
          const newPanel = createPanel(kind ?? panel.kind);
          const next = moveNode(s.root, newPanel.id, {
            nodeId: panelId,
            zone: direction === "horizontal" ? "right" : "bottom",
          });
          if ((kind ?? panel.kind) === "editor") {
            const editor = useEditorStore.getState();
            const sourceActive = editor.getPanelActiveTabId(panelId);
            if (sourceActive) {
              editor.setPanelActiveTab(newPanel.id, sourceActive);
            }
          }
          return { root: cleanupTree(next), ...markCustomized(s) };
        }),
      closePanel: (panelId) =>
        set((s) => {
          const panel = findNode(s.root, panelId);
          if (!panel || panel.type !== "panel") return s;
          // Keep at least one panel in the tree.
          const ids = s.root.type === "panel" ? [s.root.id] : [];
          if (ids.length === 1 && ids[0] === panelId) {
            return { root: createPanel("welcome"), ...markCustomized(s) };
          }
          const next = removeNode(s.root, panelId) ?? createPanel("welcome");
          const editor = useEditorStore.getState();
          if (editor.lastFocusedPanelId === panelId) {
            useEditorStore.setState({ lastFocusedPanelId: null });
          }
          return { root: cleanupTree(next), ...markCustomized(s) };
        }),
      floatPanel: (panelId) =>
        set((s) => {
          const panel = findNode(s.root, panelId);
          if (!panel || panel.type !== "panel") return s;
          const cleaned = removeNode(s.root, panelId) ?? createPanel("welcome");
          const floating = createFloating(panel, {
            x: s.ai.floating?.x ?? 120,
            y: s.ai.floating?.y ?? 80,
            width: 420,
            height: 520,
          });
          const editor = useEditorStore.getState();
          if (editor.lastFocusedPanelId === panelId) {
            useEditorStore.setState({ lastFocusedPanelId: null });
          }
          return {
            root: cleanupTree(cleaned),
            floating: [...s.floating, floating],
            ...markCustomized(s),
          };
        }),
      dockFloatingPanel: (floatingId, target) =>
        set((s) => {
          const floating = s.floating.find((f) => f.id === floatingId);
          if (!floating) return s;
          const remaining = s.floating.filter((f) => f.id !== floatingId);
          const panel = extractFirstPanel(floating.child);
          if (!panel) return { floating: remaining };
          const dropTarget: DropTarget = target ?? {
            nodeId: s.root.id,
            zone: "center",
          };
          const next =
            dropTarget.zone === "center" && s.root.type === "panel"
              ? panel
              : moveNode(s.root, panel.id, dropTarget);
          return {
            root: cleanupTree(next),
            floating: remaining,
            ...markCustomized(s),
          };
        }),
      setActiveTab: (tabsNodeId, panelId) =>
        set((s) => ({
          root: setActiveTabInTabs(s.root, tabsNodeId, panelId),
          ...markCustomized(s),
        })),
      updateSplitSizes: (splitId, sizes) =>
        set((s) => {
          const split = findNode(s.root, splitId);
          if (!split || split.type !== "split") return s;
          return { root: updateSplitSizes(split, sizes) };
        }),

      // Presets
      applyPreset: (presetId) => {
        const preset = layoutPresets[presetId];
        if (!preset) return;
        set({ ...preset, activePreset: presetId, isCustomized: false });
        // Reset panel-scoped editor state because panel IDs changed.
        useEditorStore.setState({ activeTabIds: {}, lastFocusedPanelId: null });
      },
      setActivePreset: (presetId) => set({ activePreset: presetId }),
      markCustomized: () => set({ isCustomized: true }),
    }),
    { name: STORAGE_KEY },
  ),
);

function extractFirstPanel(node: LayoutNode): LayoutNode | null {
  if (node.type === "panel") return node;
  if (node.type === "split" || node.type === "tabs") {
    return node.children.length > 0 ? extractFirstPanel(node.children[0]) : null;
  }
  if (node.type === "floating") return extractFirstPanel(node.child);
  return null;
}
