import { describe, expect, it } from "vite-plus/test";

import { MAX_IMAGE_EDGE, isAcceptedImage, readImageFile, scaledSize } from "./readImage";

describe("scaledSize", () => {
  it("keeps images that fit", () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaledSize(MAX_IMAGE_EDGE, 10)).toEqual({ width: MAX_IMAGE_EDGE, height: 10 });
  });

  it("scales the longest edge down and keeps the aspect ratio", () => {
    expect(scaledSize(3136, 1960)).toEqual({ width: MAX_IMAGE_EDGE, height: 980 });
    expect(scaledSize(1000, 4704)).toEqual({ width: 333, height: MAX_IMAGE_EDGE });
  });

  it("never scales an edge to zero", () => {
    expect(scaledSize(100_000, 10)).toEqual({ width: MAX_IMAGE_EDGE, height: 1 });
  });
});

describe("readImageFile", () => {
  it("accepts only formats every provider supports", () => {
    expect(isAcceptedImage({ type: "image/png" })).toBe(true);
    expect(isAcceptedImage({ type: "image/webp" })).toBe(true);
    expect(isAcceptedImage({ type: "image/svg+xml" })).toBe(false);
    expect(isAcceptedImage({ type: "application/pdf" })).toBe(false);
  });

  it("rejects unsupported files before decoding them", async () => {
    const file = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    await expect(readImageFile(file)).rejects.toThrow(
      "logo.svg is not a PNG, JPEG, GIF or WebP image.",
    );
  });
});
