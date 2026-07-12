import { useEffect, useMemo } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useGlobalShortcuts } from "@/shared/hooks/useGlobalShortcuts";
import { useAppShortcutActions } from "@/app/useAppShortcutActions";
import { WindowResizeHandles } from "@/shell/chrome/WindowResizeHandles";
import { useLayoutStore } from "@/shell/layout";
import { LayoutTreeRenderer } from "@/shell/layout/components/LayoutTreeRenderer";
import { panelLabel } from "@/shell/layout/components/panels/panelLabels";
import type { LayoutNode } from "@/shell/layout/tree/types";
import { ExternalWindowTitlebar } from "./ExternalWindowTitlebar";

function externalTitle(child: LayoutNode): string {
  if (child.type === "panel") return panelLabel(child.kind);
  if (child.type === "tabs") {
    if (child.children.length === 1) return panelLabel(child.children[0].kind);
    return `${child.children.length} tabs`;
  }
  return "Floating Panel";
}

interface ExternalPanelAppProps {
  nodeId: string;
}

export function ExternalPanelApp({ nodeId }: ExternalPanelAppProps) {
  const node = useLayoutStore((s) => s.floating.find((f) => f.id === nodeId));
  const title = useMemo(() => (node ? externalTitle(node.child) : "Pragma"), [node]);
  const actions = useAppShortcutActions();

  useGlobalShortcuts(actions);

  useEffect(() => {
    const win = getCurrentWindow();
    void emit("pragma:external:ready", { label: win.label, nodeId });

    const setupCloseListener = async () => {
      return win.onCloseRequested(async () => {
        const position = await win.outerPosition();
        const size = await win.outerSize();
        await emit("pragma:external:close", {
          label: win.label,
          x: (position as unknown as { x: number }).x,
          y: (position as unknown as { y: number }).y,
          width: (size as unknown as { width: number }).width,
          height: (size as unknown as { height: number }).height,
        });
      });
    };

    let unlisten: (() => void) | null = null;
    void setupCloseListener().then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [nodeId]);

  return (
    <>
      <WindowResizeHandles />
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-root text-fg-default">
        <ExternalWindowTitlebar title={title} />
        <div className="min-h-0 flex-1 overflow-hidden">
          {node ? (
            <LayoutTreeRenderer node={node.child} />
          ) : (
            <div className="flex h-full items-center justify-center text-ui-sm text-fg-muted">
              Loading panel snapshot…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
