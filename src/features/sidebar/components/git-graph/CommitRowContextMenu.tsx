import {
  ArrowCounterClockwise,
  ArrowLineDown,
  ArrowUUpLeft,
  Cherries,
  Copy,
  GitBranch,
  Info,
} from "@phosphor-icons/react";
import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/shared/components/ui/context-menu";
import type { GitLogEntry } from "./types";

export function CommitRowContextMenu({
  commit,
  onViewDetails,
  onCopySha,
  onCheckout,
  onCreateBranch,
  onCherryPick,
  onRevert,
  onReset,
}: {
  commit: GitLogEntry;
  onViewDetails: (sha: string) => void;
  onCopySha: (sha: string) => void;
  onCheckout: (sha: string) => void;
  onCreateBranch: (sha: string) => void;
  onCherryPick: (sha: string) => void;
  onRevert: (sha: string) => void;
  onReset: (sha: string, mode: "soft" | "mixed" | "hard") => void;
}) {
  return (
    <ContextMenuContent align="start" alignOffset={4} side="right" sideOffset={0}>
      <ContextMenuGroup>
        <ContextMenuLabel>{commit.short_sha}</ContextMenuLabel>
        <ContextMenuItem onClick={() => onViewDetails(commit.sha)}>
          <Info weight="regular" />
          View commit details
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopySha(commit.sha)}>
          <Copy weight="regular" />
          Copy SHA
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCheckout(commit.sha)}>
          <ArrowLineDown weight="regular" />
          Checkout commit
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCreateBranch(commit.sha)}>
          <GitBranch weight="regular" />
          Create branch from commit
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => onCherryPick(commit.sha)}>
        <Cherries weight="regular" />
        Cherry-pick commit
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRevert(commit.sha)}>
        <ArrowUUpLeft weight="regular" />
        Revert commit
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <ArrowCounterClockwise weight="regular" />
          Reset to commit
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => onReset(commit.sha, "soft")}>Soft</ContextMenuItem>
          <ContextMenuItem onClick={() => onReset(commit.sha, "mixed")}>Mixed</ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => onReset(commit.sha, "hard")}>
            Hard
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
    </ContextMenuContent>
  );
}
