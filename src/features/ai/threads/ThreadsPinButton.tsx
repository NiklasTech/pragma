import { PushPin, PushPinSlash } from "@phosphor-icons/react";

import { IconButton } from "@/shared/components/ui/icon-button";

import { useAgentsUiStore } from "../store/agentsUi";

/// Pins the thread list beside the panes, or sends it back into its drawer.
export function ThreadsPinButton() {
  const pinned = useAgentsUiStore((state) => state.threadsPinned);
  const setThreadsPinned = useAgentsUiStore((state) => state.setThreadsPinned);
  return (
    <IconButton
      icon={pinned ? PushPinSlash : PushPin}
      label={pinned ? "Unpin threads" : "Pin threads beside the panes"}
      size="sm"
      className="text-fg-subtle"
      onClick={() => setThreadsPinned(!pinned)}
    />
  );
}
