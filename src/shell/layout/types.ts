export * from "./tree/types";

// Backward-compatible aliases for code that still references the old flat types.
export type LayoutState = import("./tree/types").LayoutTreeState;
export type FullLayoutState = import("./tree/types").FullLayoutTreeState;
