import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLayoutStore } from "@/shell/layout";
import { FloatingWindow } from "@/shell/layout/components/FloatingWindow";
import { LayoutTreeRenderer } from "@/shell/layout/components/LayoutTreeRenderer";
import { panelLabel } from "@/shell/layout/components/panels/panelLabels";
import type { FloatingNode, LayoutNode } from "@/shell/layout/tree/types";

function floatingTitle(child: LayoutNode): string {
  if (child.type === "panel") return panelLabel(child.kind);
  if (child.type === "tabs") {
    if (child.children.length === 1) return panelLabel(child.children[0].kind);
    return `${child.children.length} tabs`;
  }
  return "Floating Panel";
}

export function FloatingHost() {
  const { floating, dockFloatingPanel, moveFloatingToExternal } = useLayoutStore();
  const visible = floating.filter((node) => !node.external);

  const handleExternalize = useCallback(
    async (node: FloatingNode) => {
      const title = floatingTitle(node.child);
      try {
        const label = await invoke<string>("create_external_window", {
          nodeId: node.id,
          title,
          bounds: {
            x: Math.round(node.x),
            y: Math.round(node.y),
            width: Math.round(node.width),
            height: Math.round(node.height),
          },
        });
        moveFloatingToExternal(node.id, label);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to create external window:", err);
      }
    },
    [moveFloatingToExternal],
  );

  return (
    <>
      {visible.map((node) => (
        <FloatingWindow
          key={node.id}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          minWidth={320}
          minHeight={240}
          title={
            <span className="text-ui-sm font-semibold text-fg-default">
              {floatingTitle(node.child)}
            </span>
          }
          onMove={(x, y) => {
            // Update floating node position in place.
            const next = floating.map((f) => (f.id === node.id ? { ...f, x, y } : f));
            useLayoutStore.setState({ floating: next });
          }}
          onResize={(width, height) => {
            const next = floating.map((f) => (f.id === node.id ? { ...f, width, height } : f));
            useLayoutStore.setState({ floating: next });
          }}
          onClose={() => dockFloatingPanel(node.id)}
          onExternalize={() => void handleExternalize(node)}
        >
          <div className="h-full w-full">
            <LayoutTreeRenderer node={node.child} />
          </div>
        </FloatingWindow>
      ))}
    </>
  );
}
