import type { AIMode, AIPlacement, AIState, FloatingNode, LayoutNode } from "./tree/types";
import {
  cleanupTree,
  createFloating,
  createPanel,
  ensureDockedPanel,
  findPanelByKind,
  removePanelByKind,
} from "./tree/operations";

export const defaultAIPlacement: AIPlacement = "right";

export const aiPlacementOptions: Array<{ value: AIPlacement; label: string }> = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "bottom", label: "Bottom" },
  { value: "floating", label: "Floating" },
  { value: "tab", label: "Editor tab" },
  { value: "hidden", label: "Hidden" },
];

const drawerModes: Partial<Record<AIPlacement, AIMode>> = {
  right: "drawer-right",
  left: "drawer-left",
  bottom: "bottom-sheet",
};

export interface AIPlacementState {
  ai: AIState;
  root: LayoutNode;
  floating: FloatingNode[];
}

export type AIPlacementResult = AIPlacementState;

export function normalizeAIPlacement(value: unknown): AIPlacement {
  return aiPlacementOptions.some((option) => option.value === value)
    ? (value as AIPlacement)
    : defaultAIPlacement;
}

/// Floating, bottom and editor-tab placements are no longer first-class. Stored
/// values migrate onto the editor dock so the shortcut keeps working.
export function normalizeDockPlacement(value: unknown): AIPlacement {
  const placement = normalizeAIPlacement(value);
  if (placement === "left" || placement === "hidden") return placement;
  return "right";
}

export function needsDockMigration(value: unknown): boolean {
  return value === "floating" || value === "bottom" || value === "tab";
}

export function hasMountedAIPanel(state: Pick<AIPlacementState, "root" | "floating">): boolean {
  return (
    findPanelByKind(state.root, "ai") !== null ||
    state.floating.some((node) => findPanelByKind(node.child, "ai") !== null)
  );
}

export function removeMountedAIPanel(
  state: AIPlacementState,
): Pick<AIPlacementResult, "root" | "floating"> {
  return {
    root: removeRootAI(state.root),
    floating: removeFloatingAI(state.floating),
  };
}

export function hideAIPanel(state: AIPlacementState): AIPlacementResult {
  return {
    ai: { ...state.ai, mode: "hidden" },
    ...removeMountedAIPanel(state),
  };
}

export function applyAIPlacement(
  state: AIPlacementState,
  placement: AIPlacement,
): AIPlacementResult {
  const drawerMode = drawerModes[placement];
  if (drawerMode) {
    const hidden = hideAIPanel(state);
    return { ...hidden, ai: { ...hidden.ai, mode: drawerMode, placement } };
  }

  if (placement === "floating") {
    return {
      ai: { ...state.ai, mode: "hidden", placement },
      root: removeRootAI(state.root),
      floating: ensureFloatingAI(state),
    };
  }

  if (placement === "tab") {
    return {
      ai: { ...state.ai, mode: "hidden", placement },
      root: ensureDockedPanel(state.root, "ai"),
      floating: removeFloatingAI(state.floating),
    };
  }

  return { ...hideAIPanel(state), ai: { ...state.ai, mode: "hidden", placement: "hidden" } };
}

export function toggleAIPlacement(state: AIPlacementState): AIPlacementResult {
  if (state.ai.mode !== "hidden" || hasMountedAIPanel(state)) {
    return hideAIPanel(state);
  }
  const placement = state.ai.placement === "hidden" ? defaultAIPlacement : state.ai.placement;
  return applyAIPlacement(state, placement);
}

function removeRootAI(root: LayoutNode): LayoutNode {
  if (!findPanelByKind(root, "ai")) return root;
  return cleanupTree(removePanelByKind(root, "ai"));
}

function removeFloatingAI(floating: FloatingNode[]): FloatingNode[] {
  return floating.filter((node) => findPanelByKind(node.child, "ai") === null);
}

function ensureFloatingAI(state: AIPlacementState): FloatingNode[] {
  if (state.floating.some((node) => findPanelByKind(node.child, "ai"))) {
    return state.floating;
  }
  const panel = findPanelByKind(state.root, "ai") ?? createPanel("ai");
  return [
    ...removeFloatingAI(state.floating),
    createFloating(panel, {
      x: state.ai.floating.x,
      y: state.ai.floating.y,
      width: state.ai.floating.width,
      height: state.ai.floating.height,
    }),
  ];
}
