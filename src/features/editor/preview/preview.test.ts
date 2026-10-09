import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useEditorStore } from "@/shared/stores/editor";

import { isBinaryFileError, isImagePath, openNonTextFile, openPreviewTab } from "./openPreview";
import { formatBytes, nextZoom } from "./zoom";

describe("preview detection", () => {
  it("recognizes image files by extension", () => {
    expect(isImagePath("/repo/assets/logo.PNG")).toBe(true);
    expect(isImagePath("C:\\repo\\icon.svg")).toBe(true);
    expect(isImagePath("/repo/main.ts")).toBe(false);
    expect(isImagePath("/repo/.png")).toBe(false);
  });

  it("matches the binary file error of read_text_file", () => {
    expect(isBinaryFileError("Binary files are not supported")).toBe(true);
    expect(isBinaryFileError("File is too large (12 MB).")).toBe(false);
  });
});

describe("preview tabs", () => {
  beforeEach(() => {
    useEditorStore.setState({ tabs: [], tabStates: [], activeTabId: null, activeTabIds: {} });
  });

  it("opens one tab per file and focuses it again", () => {
    openPreviewTab("/repo/logo.png", "image", "panel-1");
    openPreviewTab("/repo/logo.png", "image", null);
    const { tabs, activeTabId, activeTabIds } = useEditorStore.getState();
    expect(tabs).toEqual([
      {
        id: "preview:/repo/logo.png",
        kind: "preview",
        path: "/repo/logo.png",
        name: "logo.png",
        previewKind: "image",
      },
    ]);
    expect(activeTabId).toBe("preview:/repo/logo.png");
    expect(activeTabIds["panel-1"]).toBe("preview:/repo/logo.png");
  });

  it("opens images directly and other files only after a binary error", () => {
    expect(openNonTextFile("/repo/photo.jpg", null)).toBe(true);
    expect(openNonTextFile("/repo/app.wasm", null)).toBe(false);
    expect(openNonTextFile("/repo/app.wasm", null, "Binary files are not supported")).toBe(true);
    expect(openNonTextFile("/repo/big.log", null, "File is too large")).toBe(false);
    const kinds = useEditorStore
      .getState()
      .tabs.map((tab) => tab.kind === "preview" && tab.previewKind);
    expect(kinds).toEqual(["image", "binary"]);
  });
});

describe("zoom", () => {
  it("steps through zoom levels and starts at 100% from Fit", () => {
    expect(nextZoom("fit", 1)).toBe(1);
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(8, 1)).toBe(8);
    expect(nextZoom(0.1, -1)).toBe(0.1);
  });

  it("formats file sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
