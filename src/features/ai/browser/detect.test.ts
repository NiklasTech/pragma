import { describe, expect, it } from "vite-plus/test";

import { findLatestLocalUrl } from "./detect";

describe("findLatestLocalUrl", () => {
  it("finds a dev server URL through terminal colors", () => {
    const output =
      "  \u001b[32m➜\u001b[39m  Local:   \u001b[36mhttp://localhost:\u001b[1m5173\u001b[22m/\u001b[39m\n";
    expect(findLatestLocalUrl(output)).toBe("http://localhost:5173/");
  });

  it("returns the last local URL and ignores remote ones", () => {
    const text = "first http://127.0.0.1:3000, then http://[::1]:4000/app. See https://example.com";
    expect(findLatestLocalUrl(text)).toBe("http://[::1]:4000/app");
  });

  it("returns null without a local URL", () => {
    expect(findLatestLocalUrl("Open https://example.com")).toBeNull();
  });
});
