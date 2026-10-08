import { describe, expect, it } from "vite-plus/test";

import { isToolImageOutput, toolOutputImages, toolOutputText } from "./toolOutput";

const screenshot = { text: "Screenshot", images: [{ mediaType: "image/png", data: "aGk=" }] };

describe("tool outputs", () => {
  it("recognizes outputs with images", () => {
    expect(isToolImageOutput(screenshot)).toBe(true);
    expect(isToolImageOutput({ text: "x", images: [{ mediaType: "image/png" }] })).toBe(false);
    expect(isToolImageOutput("text")).toBe(false);
  });

  it("returns the text without the image data", () => {
    expect(toolOutputText(screenshot)).toBe("Screenshot");
    expect(toolOutputText("plain")).toBe("plain");
    expect(toolOutputText({ a: 1 })).toBe('{"a":1}');
  });

  it("returns the images only for image outputs", () => {
    expect(toolOutputImages(screenshot)).toEqual(screenshot.images);
    expect(toolOutputImages("plain")).toEqual([]);
  });
});
