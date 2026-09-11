import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";
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

const VISIBLE_GRIP = 40;

function clampFloating(node: FloatingNode): FloatingNode {
  const maxX = Math.max(0, window.innerWidth - VISIBLE_GRIP);
  const maxY = Math.max(0, window.innerHeight - VISIBLE_GRIP);
  return {
    ...node,
    x: Math.max(0, Math.min(node.x, maxX)),
    y: Math.max(0, Math.min(node.y, maxY)),
  };
}

async function clientToScreen(x: number, y: number): Promise<{ x: number; y: number }> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const factor = await win.scaleFactor();
    return { x: pos.x / factor + x, y: pos.y / factor + y };
  } catch {
    return { x, y };
  }
}

async function waitForExternalReady(
  nodeId: string,
  timeoutMs: number,
): Promise<() => Promise<boolean>> {
  let settled = false;
  let resolveWait: (ok: boolean) => void = () => {};
  let unlisten: (() => void) | undefined;
  let timer = 0;
  const wait = new Promise<boolean>((resolve) => {
    resolveWait = resolve;
  });

  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    unlisten?.();
    resolveWait(ok);
  };

  unlisten = await listen<{ nodeId: string }>("pragma:external:ready", (event) => {
    if (event.payload.nodeId !== nodeId) return;
    finish(true);
  });
  timer = window.setTimeout(() => finish(false), timeoutMs);

  return () => wait;
}

export function FloatingHost() {
  const floating = useLayoutStore((s) => s.floating);
  const dockFloatingPanel = useLayoutStore((s) => s.dockFloatingPanel);
  const moveFloatingToExternal = useLayoutStore((s) => s.moveFloatingToExternal);
  const visible = floating.filter((node) => !node.external);

  // Clamp floating panels to the viewport on mount and resize so a persisted
  // off-screen position cannot trap the panel or block the titlebar.
  useEffect(() => {
    const clampAll = () => {
      const next = floating.map(clampFloating);
      if (next.some((f, i) => f.x !== floating[i].x || f.y !== floating[i].y)) {
        useLayoutStore.setState({ floating: next });
      }
    };

    clampAll();
    window.addEventListener("resize", clampAll);
    return () => window.removeEventListener("resize", clampAll);
  }, [floating]);

  const handleExternalize = useCallback(
    async (node: FloatingNode) => {
      const title = floatingTitle(node.child);
      const screen = await clientToScreen(node.x, node.y);
      const bounds = {
        x: Math.round(screen.x),
        y: Math.round(screen.y),
        width: Math.round(node.width),
        height: Math.round(node.height),
      };
      try {
        await invoke("close_external_window", { label: node.id }).catch(() => {});
        const awaitReady = await waitForExternalReady(node.id, 8000);
        const newLabel = await invoke<string>("create_external_window", {
          request: { nodeId: node.id, title, bounds },
        });
        const ok = await awaitReady();
        if (!ok) {
          await invoke("close_external_window", { label: newLabel }).catch(() => {});
          toast.error("Could not open a separate window. The panel stays in Pragma.");
          return;
        }
        moveFloatingToExternal(node.id, newLabel);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`External window failed: ${message}`);
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
            const next = floating.map((f) =>
              f.id === node.id ? clampFloating({ ...f, x, y }) : f,
            );
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
