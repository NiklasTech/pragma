import type { RefObject } from "react";
import type { GitBranch } from "@/shared/stores/git";
import { BranchRow } from "./BranchRow";
import { CreateBranchSection } from "./CreateBranchSection";

interface BranchListPopoverProps {
  branches: GitBranch[];
  currentBranch: string;
  pendingBranch: string | null;
  actionBusy: string | null;
  creating: boolean;
  newBranchName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelectBranch: (branchName: string) => void;
  onDeleteBranch: (branchName: string) => void;
  onNameChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onCreateSubmit: () => void;
  onCreateClick: () => void;
  onCancelCreate: () => void;
}

export function BranchListPopover({
  branches,
  currentBranch,
  pendingBranch,
  actionBusy,
  creating,
  newBranchName,
  inputRef,
  onSelectBranch,
  onDeleteBranch,
  onNameChange,
  onKeyDown,
  onCreateSubmit,
  onCreateClick,
  onCancelCreate,
}: BranchListPopoverProps) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-bg-elevated shadow-lg shadow-black/10">
      <div className="max-h-72 overflow-y-auto py-1">
        {branches.map((branch) => (
          <BranchRow
            key={branch.name}
            branch={branch}
            isCurrent={branch.name === currentBranch}
            isPending={pendingBranch === branch.name}
            isDeleteBusy={actionBusy === "delete-branch"}
            onSelect={onSelectBranch}
            onDelete={onDeleteBranch}
          />
        ))}
      </div>

      <CreateBranchSection
        creating={creating}
        newBranchName={newBranchName}
        inputRef={inputRef}
        isCreateBusy={actionBusy === "create-branch"}
        onNameChange={onNameChange}
        onKeyDown={onKeyDown}
        onSubmit={onCreateSubmit}
        onCreateClick={onCreateClick}
        onCancel={onCancelCreate}
      />
    </div>
  );
}
