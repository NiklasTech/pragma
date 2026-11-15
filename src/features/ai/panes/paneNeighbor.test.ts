import { describe, expect, it } from "vite-plus/test";

import { pickNeighbor, type PlacedPane } from "./paneNeighbor";

const rect = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

// A 2 by 2 grid with a wide pane below it:
//   a | b
//   c | d
//   e e e
const GRID: PlacedPane[] = [
  { id: "a", rect: rect(0, 0, 100, 100) },
  { id: "b", rect: rect(108, 0, 208, 100) },
  { id: "c", rect: rect(0, 108, 100, 208) },
  { id: "d", rect: rect(108, 108, 208, 208) },
  { id: "e", rect: rect(0, 216, 208, 300) },
];

const from = (id: string) => GRID.find((pane) => pane.id === id)!.rect;
const others = (id: string) => GRID.filter((pane) => pane.id !== id);

describe("pickNeighbor", () => {
  it("moves along rows and columns", () => {
    expect(pickNeighbor(from("a"), others("a"), "right")).toBe("b");
    expect(pickNeighbor(from("b"), others("b"), "left")).toBe("a");
    expect(pickNeighbor(from("a"), others("a"), "down")).toBe("c");
    expect(pickNeighbor(from("d"), others("d"), "up")).toBe("b");
  });

  it("prefers the nearest pane that shares the edge", () => {
    expect(pickNeighbor(from("b"), others("b"), "down")).toBe("d");
    expect(pickNeighbor(from("d"), others("d"), "down")).toBe("e");
  });

  it("breaks a tie by the pane most in line", () => {
    // Both share 100px of the edge at the same distance; the left one sits closer to the middle.
    const current = rect(0, 0, 200, 100);
    const left = { id: "l", rect: rect(0, 108, 100, 200) };
    const right = { id: "r", rect: rect(100, 108, 300, 200) };
    expect(pickNeighbor(current, [right, left], "down")).toBe("l");
  });

  it("stays put at the edge of the layout", () => {
    expect(pickNeighbor(from("a"), others("a"), "left")).toBeNull();
    expect(pickNeighbor(from("e"), others("e"), "down")).toBeNull();
  });
});
