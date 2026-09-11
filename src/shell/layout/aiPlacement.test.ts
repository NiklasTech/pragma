import { describe, expect, it } from "vite-plus/test";
import {
  applyAIPlacement,
  defaultAIPlacement,
  hasMountedAIPanel,
  normalizeAIPlacement,
  toggleAIPlacement,
  type AIPlacementState,
} from "./aiPlacement";
import { createPanel, createSplit, createTabs, findPanelByKind } from "./tree/operations";
import { layoutPresets } from "./presets";
import type { LayoutNode } from "./tree/types";

function editorRoot(): LayoutNode {
  return createTabs([createPanel("editor")]);
}

function dockedAIRoot(): LayoutNode {
  return createSplit("vertical", [editorRoot(), createPanel("ai")]);
}

function makeState(overrides: Partial<AIPlacementState> = {}): AIPlacementState {
  return {
    ai: {
      mode: "hidden",
      placement: "right",
      size: 360,
      floating: { x: 120, y: 80, width: 420, height: 520 },
    },
    root: editorRoot(),
    floating: [],
    ...overrides,
  };
}

describe("applyAIPlacement", () => {
  it("maps right to the right drawer without a mounted panel", () => {
    const next = applyAIPlacement(makeState({ root: dockedAIRoot() }), "right");
    expect(next.ai.mode).toBe("drawer-right");
    expect(next.ai.placement).toBe("right");
    expect(hasMountedAIPanel(next)).toBe(false);
    expect(findPanelByKind(next.root, "ai")).toBeNull();
  });

  it("maps left to the left drawer", () => {
    const next = applyAIPlacement(makeState(), "left");
    expect(next.ai.mode).toBe("drawer-left");
    expect(next.ai.placement).toBe("left");
    expect(hasMountedAIPanel(next)).toBe(false);
  });

  it("maps bottom to the bottom sheet", () => {
    const next = applyAIPlacement(makeState(), "bottom");
    expect(next.ai.mode).toBe("bottom-sheet");
    expect(next.ai.placement).toBe("bottom");
    expect(hasMountedAIPanel(next)).toBe(false);
  });

  it("moves a docked panel into a floating window", () => {
    const next = applyAIPlacement(makeState({ root: dockedAIRoot() }), "floating");
    expect(next.ai.mode).toBe("hidden");
    expect(next.ai.placement).toBe("floating");
    expect(findPanelByKind(next.root, "ai")).toBeNull();
    expect(next.floating).toHaveLength(1);
    expect(findPanelByKind(next.floating[0].child, "ai")).not.toBeNull();
    expect(next.floating[0].width).toBe(420);
  });

  it("keeps a single floating panel when applied twice", () => {
    const first = applyAIPlacement(makeState(), "floating");
    const second = applyAIPlacement(first, "floating");
    expect(second.floating).toHaveLength(1);
    expect(second.floating[0].id).toBe(first.floating[0].id);
  });

  it("docks the panel next to the editor for the tab placement", () => {
    const next = applyAIPlacement(makeState(), "tab");
    expect(next.ai.mode).toBe("hidden");
    expect(next.ai.placement).toBe("tab");
    expect(findPanelByKind(next.root, "ai")).not.toBeNull();
    expect(hasMountedAIPanel(next)).toBe(true);
  });

  it("pulls a floating panel back into the tree for the tab placement", () => {
    const floating = applyAIPlacement(makeState(), "floating");
    const next = applyAIPlacement(floating, "tab");
    expect(next.floating).toHaveLength(0);
    expect(findPanelByKind(next.root, "ai")).not.toBeNull();
  });

  it("removes the panel from tree and floating when hidden", () => {
    const docked = applyAIPlacement(makeState({ root: dockedAIRoot() }), "hidden");
    expect(docked.ai.mode).toBe("hidden");
    expect(hasMountedAIPanel(docked)).toBe(false);

    const floating = applyAIPlacement(makeState(), "floating");
    const hidden = applyAIPlacement(floating, "hidden");
    expect(hidden.floating).toHaveLength(0);
    expect(hasMountedAIPanel(hidden)).toBe(false);
  });

  it("leaves a complete IDE when the AI panel was the only root panel", () => {
    const next = applyAIPlacement(makeState({ root: createPanel("ai") }), "hidden");
    expect(next.root.type).toBe("panel");
    expect((next.root as ReturnType<typeof createPanel>).kind).toBe("welcome");
  });

  it("never leaves both a drawer and a mounted panel", () => {
    for (const placement of ["right", "left", "bottom", "floating", "tab", "hidden"] as const) {
      const next = applyAIPlacement(makeState({ root: dockedAIRoot() }), placement);
      const drawerVisible = next.ai.mode !== "hidden";
      expect(drawerVisible && hasMountedAIPanel(next)).toBe(false);
    }
  });

  it("defaults unknown placements to right", () => {
    expect(normalizeAIPlacement(undefined)).toBe(defaultAIPlacement);
    expect(normalizeAIPlacement("bogus")).toBe(defaultAIPlacement);
    expect(normalizeAIPlacement("tab")).toBe("tab");
  });
});

describe("toggleAIPlacement", () => {
  it("hides a visible drawer and keeps the preferred placement", () => {
    const visible = applyAIPlacement(makeState(), "left");
    const next = toggleAIPlacement(visible);
    expect(next.ai.mode).toBe("hidden");
    expect(next.ai.placement).toBe("left");
  });

  it("hides a mounted panel", () => {
    const docked = applyAIPlacement(makeState(), "tab");
    const next = toggleAIPlacement(docked);
    expect(next.ai.mode).toBe("hidden");
    expect(hasMountedAIPanel(next)).toBe(false);
  });

  it("shows the preferred placement when hidden", () => {
    const next = toggleAIPlacement(makeState({ ai: { ...makeState().ai, placement: "bottom" } }));
    expect(next.ai.mode).toBe("bottom-sheet");
  });

  it("falls back to the default placement when the preference is hidden", () => {
    const next = toggleAIPlacement(makeState({ ai: { ...makeState().ai, placement: "hidden" } }));
    expect(next.ai.mode).toBe("drawer-right");
    expect(next.ai.placement).toBe(defaultAIPlacement);
  });

  it("round-trips a docked panel back to its preferred placement", () => {
    const docked = applyAIPlacement(makeState(), "floating");
    const hidden = toggleAIPlacement(docked);
    const shown = toggleAIPlacement(hidden);
    expect(shown.ai.mode).toBe("hidden");
    expect(shown.floating).toHaveLength(1);
  });
});

describe("AI layout presets", () => {
  it("keeps the classic preset hidden and the ai-heavy preset on the right", () => {
    expect(layoutPresets.classic.ai.placement).toBe("hidden");
    expect(layoutPresets["ai-heavy"].ai.placement).toBe("right");
  });
});
