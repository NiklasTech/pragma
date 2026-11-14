import type { ComponentType } from "react";
import type { OverlayId } from "@/shared/stores/overlays";
import { GoToFile } from "./GoToFile";

// Each overlay reads its own open state from the overlay store, so closing keeps its exit animation.
// Overlays render in a portal beside the workspace and never unmount panes, terminals or agents.
export const HOSTED_OVERLAYS: ReadonlyArray<readonly [OverlayId, ComponentType]> = [
  ["goTo", GoToFile],
];

export function OverlayHost() {
  return (
    <>
      {HOSTED_OVERLAYS.map(([id, Overlay]) => (
        <Overlay key={id} />
      ))}
    </>
  );
}
