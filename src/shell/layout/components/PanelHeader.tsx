import {
  Code,
  Terminal,
  Play,
  GitDiff,
  GitBranch,
  Robot,
  Article,
  Eye,
  WarningCircle,
  House,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import type { PanelKind } from "@/shell/layout/tree/types";
import { panelLabel } from "./panels/panelLabels";
import { useLayoutStore } from "@/shell/layout/store";

const kindIcons: Record<PanelKind, React.ComponentType<{ size?: number; className?: string }>> = {
  welcome: House,
  editor: Code,
  terminal: Terminal,
  "run-output": Play,
  output: Play,
  "git-diff": GitDiff,
  "git-history": GitBranch,
  "ai-diff": Robot,
  markdown: Article,
  preview: Eye,
  problems: WarningCircle,
};

interface PanelHeaderProps {
  panelId: string;
  kind: PanelKind;
}

export function PanelHeader({ panelId, kind }: PanelHeaderProps) {
  const closePanel = useLayoutStore((s) => s.closePanel);
  const Icon = kindIcons[kind] ?? Code;

  return (
    <div
      className={cn(
        "flex h-[26px] shrink-0 items-center justify-between gap-2 border-b border-border bg-bg-surface px-2 text-ui-xs text-fg-muted",
        kind === "welcome" && "cursor-default",
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <Icon size={12} className="text-fg-subtle" />
        <span className="truncate">{panelLabel(kind)}</span>
      </span>
      {kind !== "welcome" && (
        <button
          type="button"
          onClick={() => closePanel(panelId)}
          className="rounded p-0.5 text-fg-subtle transition-colors hover:text-fg-default focus-visible:opacity-100"
          aria-label={`Close ${panelLabel(kind)} panel`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
