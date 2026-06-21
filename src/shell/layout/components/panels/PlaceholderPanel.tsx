import type { PanelKind } from "../../tree/types";

interface PlaceholderPanelProps {
  kind: PanelKind;
}

export default function PlaceholderPanel({ kind }: PlaceholderPanelProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
      <span className="capitalize">{kind.replace(/-/g, " ")}</span>
      <span className="text-ui-xs">Panel not yet implemented.</span>
    </div>
  );
}
