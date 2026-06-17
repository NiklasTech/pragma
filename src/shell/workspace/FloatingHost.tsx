import { useLayoutStore } from "@/shell/layout";
import { FloatingWindow } from "@/shell/layout/components/FloatingWindow";
import { LayoutTreeRenderer } from "@/shell/layout/components/LayoutTreeRenderer";
import { panelLabel } from "@/shell/layout/components/panels/panelLabels";
import type { LayoutNode } from "@/shell/layout/tree/types";

function floatingTitle(child: LayoutNode): string {
  if (child.type === "panel") return panelLabel(child.kind);
  if (child.type === "tabs") {
    if (child.children.length === 1) return panelLabel(child.children[0].kind);
    return `${child.children.length} tabs`;
  }
  return "Floating Panel";
}

export function FloatingHost() {
  const { floating, dockFloatingPanel } = useLayoutStore();

  return (
    <>
      {floating.map((node) => (
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
        >
          <div className="h-full w-full">
            <LayoutTreeRenderer node={node.child} />
          </div>
        </FloatingWindow>
      ))}
    </>
  );
}
