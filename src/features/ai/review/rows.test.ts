import { describe, expect, it } from "vite-plus/test";

import { editKind, reviewKind } from "./rows";

describe("reviewKind", () => {
  it("maps git status codes to file kinds", () => {
    expect(reviewKind("?")).toBe("added");
    expect(reviewKind("A")).toBe("added");
    expect(reviewKind("D")).toBe("deleted");
    expect(reviewKind("M")).toBe("modified");
    expect(reviewKind("R")).toBe("modified");
  });
});

describe("editKind", () => {
  it("classifies a pending edit from its two sides", () => {
    expect(editKind("", "content")).toBe("added");
    expect(editKind("content", "")).toBe("deleted");
    expect(editKind("before", "after")).toBe("modified");
  });
});
