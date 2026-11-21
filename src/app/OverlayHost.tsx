import { Suspense, lazy, useEffect, useState, type ComponentType } from "react";
import { useOverlayStore, type OverlayId } from "@/shared/stores/overlays";

/// Time after startup before the overlays load, so they stay out of the first paint.
const PRELOAD_DELAY_MS = 1500;

const GoTo = lazy(() => import("./goTo/GoTo").then((m) => ({ default: m.GoTo })));
const SpacesOverlay = lazy(() =>
  import("@/shell/spaces/SpacesOverlay").then((m) => ({ default: m.SpacesOverlay })),
);
const QuickStartDialog = lazy(() =>
  import("@/features/ai/quickStart/QuickStartDialog").then((m) => ({
    default: m.QuickStartDialog,
  })),
);
const AgentsOverview = lazy(() =>
  import("@/features/ai/overview/AgentsOverview").then((m) => ({ default: m.AgentsOverview })),
);
const AgentPeek = lazy(() =>
  import("@/features/ai/peek/AgentPeek").then((m) => ({ default: m.AgentPeek })),
);
const ReviewOverlay = lazy(() =>
  import("@/features/ai/review/ReviewOverlay").then((m) => ({ default: m.ReviewOverlay })),
);
const SettingsOverlay = lazy(() =>
  import("@/features/settings/components/SettingsOverlay").then((m) => ({
    default: m.SettingsOverlay,
  })),
);

// Each overlay reads its own open state from the overlay store, so closing keeps its exit animation.
// Overlays render in a portal beside the workspace and never unmount panes, terminals or agents.
export const HOSTED_OVERLAYS: ReadonlyArray<readonly [OverlayId, ComponentType]> = [
  ["goTo", GoTo],
  ["spaces", SpacesOverlay],
  ["quickStart", QuickStartDialog],
  ["overview", AgentsOverview],
  ["peek", AgentPeek],
  ["review", ReviewOverlay],
  ["settings", SettingsOverlay],
];

/// Mounts the overlays shortly after startup, closed, as before; one opened earlier mounts at once.
export function OverlayHost() {
  const active = useOverlayStore((state) => state.active);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), PRELOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {HOSTED_OVERLAYS.map(([id, Overlay]) =>
        ready || id === active ? (
          <Suspense key={id} fallback={null}>
            <Overlay />
          </Suspense>
        ) : null,
      )}
    </>
  );
}
