import { describe, expect, it } from "vite-plus/test";

import { snapshotCrop } from "./screenshot";

describe("snapshotCrop", () => {
  it("scales the frame to the snapshot's pixel density", () => {
    const frame = { left: 100, top: 40, width: 600, height: 400 };
    expect(snapshotCrop(frame, 1200, { width: 2400, height: 1600 })).toEqual({
      x: 200,
      y: 80,
      width: 1200,
      height: 800,
    });
  });

  it("clips the frame to the snapshot", () => {
    const frame = { left: -50, top: 700, width: 400, height: 300 };
    expect(snapshotCrop(frame, 1200, { width: 1200, height: 800 })).toEqual({
      x: 0,
      y: 700,
      width: 350,
      height: 100,
    });
  });

  it("returns null when nothing of the frame is visible", () => {
    expect(
      snapshotCrop({ left: 0, top: 0, width: 0, height: 0 }, 1200, { width: 1200, height: 800 }),
    ).toBeNull();
    expect(
      snapshotCrop({ left: 1300, top: 0, width: 200, height: 200 }, 1200, {
        width: 1200,
        height: 800,
      }),
    ).toBeNull();
  });
});
