import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({})),
}));

import { ExternalWindowTitlebar } from "./ExternalWindowTitlebar";

describe("ExternalWindowTitlebar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides the custom window buttons on mac", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });

    const html = renderToStaticMarkup(<ExternalWindowTitlebar title="Terminal" />);

    expect(html).toContain("Dock into main window");
    expect(html).not.toContain('aria-label="Minimize"');
    expect(html).not.toContain('aria-label="Close"');
  });

  it("keeps the custom window buttons off mac", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    const html = renderToStaticMarkup(<ExternalWindowTitlebar title="Terminal" />);

    expect(html).toContain('aria-label="Minimize"');
    expect(html).toContain('aria-label="Close"');
  });
});
