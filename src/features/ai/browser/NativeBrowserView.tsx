"use client";

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/// Popups render in the page below the native webview, so it steps aside while one is open.
const COVERING_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

interface PaneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const pendingByLeaf = new Map<string, Promise<unknown>>();

/// Runs show and close of one pane in order, so a close never overtakes the show it undoes.
function inOrder<T>(leafId: string, run: () => Promise<T>): Promise<T> {
  const next = (pendingByLeaf.get(leafId) ?? Promise.resolve()).catch(() => {}).then(run);
  pendingByLeaf.set(leafId, next);
  const forget = () => {
    if (pendingByLeaf.get(leafId) === next) pendingByLeaf.delete(leafId);
  };
  next.then(forget, forget);
  return next;
}

function boundsOf(element: HTMLElement): PaneBounds {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/// Keeps a native child webview showing `url` exactly over this element.
export function NativeBrowserView({
  leafId,
  url,
  onError,
}: {
  leafId: string;
  url: string;
  onError: (error: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    let ready = false;
    let disposed = false;
    let lastPlacement = "";

    const tick = () => {
      if (ready) {
        const bounds = boundsOf(element);
        const visible =
          bounds.width > 0 && bounds.height > 0 && !document.querySelector(COVERING_SELECTOR);
        const placement = JSON.stringify([bounds, visible]);
        if (placement !== lastPlacement) {
          lastPlacement = placement;
          void invoke("browser_webview_place", { leafId, bounds, visible }).catch(() => {});
        }
      }
      frame = requestAnimationFrame(tick);
    };

    inOrder(leafId, () =>
      invoke("browser_webview_show", { leafId, url, bounds: boundsOf(element) }),
    )
      .then(() => {
        if (!disposed) ready = true;
      })
      .catch((err: unknown) => {
        if (!disposed) onErrorRef.current(String(err));
      });
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      void inOrder(leafId, () => invoke("browser_webview_close", { leafId })).catch(() => {});
    };
  }, [leafId, url]);

  return <div ref={ref} className="h-full w-full bg-bg-root" />;
}
