import { useEffect, useState } from "react";
import { CheckCircle, GitBranch, GitCommit, GitMerge, GitPullRequest } from "@phosphor-icons/react";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { isGhReady, type FinishAction } from "./finish";

function FinishItems({ onFinish }: { onFinish: (action: FinishAction) => void }) {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const [ghReady, setGhReady] = useState(false);

  useEffect(() => {
    if (!rootPath) return;
    let live = true;
    void isGhReady(rootPath).then((ready) => {
      if (live) setGhReady(ready);
    });
    return () => {
      live = false;
    };
  }, [rootPath]);

  return (
    <>
      <DropdownMenuItem onClick={() => onFinish("merge")}>
        <GitMerge size={14} />
        Merge into current branch
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onFinish("merge-commit")}>
        <GitCommit size={14} />
        Merge with a merge commit
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onFinish("rebase")}>
        <GitBranch size={14} />
        Rebase onto current branch and merge
      </DropdownMenuItem>
      {ghReady && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onFinish("pull-request")}>
            <GitPullRequest size={14} />
            Push and open pull request
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

export function FinishWorktreeMenu({
  disabled,
  onFinish,
}: {
  disabled: boolean;
  onFinish: (action: FinishAction) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        disabled={disabled}
        title={disabled ? "Wait until the session is idle" : undefined}
      >
        <CheckCircle size={14} />
        Finish
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[240px]">
        <FinishItems onFinish={onFinish} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
