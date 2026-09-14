import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({})),
}));

import { WindowResizeHandles } from "./WindowResizeHandles";

function handlesIn(html: string): number {
  return html.match(/aria-hidden="true"/g)?.length ?? 0;
}

describe("WindowResizeHandles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all eight handles on non-mac platforms", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    expect(handlesIn(renderToStaticMarkup(<WindowResizeHandles />))).toBe(8);
  });

  it("renders nothing on mac where the OS provides resize borders", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });

    expect(renderToStaticMarkup(<WindowResizeHandles />)).toBe("");
  });
});
