import { describe, expect, it } from "vite-plus/test";

import { BROWSER_URL_ERROR, parseBrowserUrl } from "./url";

describe("parseBrowserUrl", () => {
  it("accepts http and https URLs", () => {
    expect(parseBrowserUrl("http://127.0.0.1:3000")).toEqual({
      ok: true,
      url: "http://127.0.0.1:3000/",
    });
    expect(parseBrowserUrl(" https://example.com/docs ")).toEqual({
      ok: true,
      url: "https://example.com/docs",
    });
  });

  it("adds http to a bare local host and https to other hosts", () => {
    expect(parseBrowserUrl("localhost:5173")).toEqual({ ok: true, url: "http://localhost:5173/" });
    expect(parseBrowserUrl("127.0.0.1:8080/app")).toEqual({
      ok: true,
      url: "http://127.0.0.1:8080/app",
    });
    expect(parseBrowserUrl("example.com")).toEqual({ ok: true, url: "https://example.com/" });
  });

  it("rejects other schemes and empty input", () => {
    for (const input of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,x", ""]) {
      expect(parseBrowserUrl(input)).toEqual({ ok: false, error: BROWSER_URL_ERROR });
    }
  });
});
