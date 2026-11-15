import type { RefObject } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Check, Plus, Spinner, X } from "@phosphor-icons/react";

interface CreateBranchSectionProps {
  creating: boolean;
  newBranchName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isCreateBusy: boolean;
  onNameChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onSubmit: () => void;
  onCreateClick: () => void;
  onCancel: () => void;
}

export function CreateBranchSection({
  creating,
  newBranchName,
  inputRef,
  isCreateBusy,
  onNameChange,
  onKeyDown,
  onSubmit,
  onCreateClick,
  onCancel,
}: CreateBranchSectionProps) {
  return (
    <div className="border-t border-border px-2 py-1.5">
      {creating ? (
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={newBranchName}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Branch name"
            className="h-7 text-ui-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => onSubmit()}
            disabled={!newBranchName.trim() || isCreateBusy}
          >
            {isCreateBusy ? <Spinner size={14} className="animate-spin" /> : <Check size={14} />}
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={onCancel}>
            <X size={14} />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateClick}
          className="w-full justify-start gap-1.5 px-2 text-ui-sm font-normal"
        >
          <Plus size={12} />
          Create new branch
        </Button>
      )}
    </div>
  );
}
