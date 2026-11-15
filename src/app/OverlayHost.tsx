import type { ComponentType } from "react";
import type { OverlayId } from "@/shared/stores/overlays";
import { AgentsOverview } from "@/features/ai/overview/AgentsOverview";
import { AgentPeek } from "@/features/ai/peek/AgentPeek";
import { QuickStartDialog } from "@/features/ai/quickStart/QuickStartDialog";
import { SpacesOverlay } from "@/shell/spaces/SpacesOverlay";
import { GoToFile } from "./GoToFile";

// Each overlay reads its own open state from the overlay store, so closing keeps its exit animation.
// Overlays render in a portal beside the workspace and never unmount panes, terminals or agents.
export const HOSTED_OVERLAYS: ReadonlyArray<readonly [OverlayId, ComponentType]> = [
  ["goTo", GoToFile],
  ["spaces", SpacesOverlay],
  ["quickStart", QuickStartDialog],
  ["overview", AgentsOverview],
  ["peek", AgentPeek],
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
