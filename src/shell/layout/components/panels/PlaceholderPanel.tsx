import { Question } from "@phosphor-icons/react";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import type { PanelKind } from "../../tree/types";

interface PlaceholderPanelProps {
  kind: PanelKind;
}

export default function PlaceholderPanel({ kind }: PlaceholderPanelProps) {
  return (
    <PanelEmptyState
      icon={Question}
      title={kind.replace(/-/g, " ")}
      description="Panel not yet implemented."
    />
  );
}
