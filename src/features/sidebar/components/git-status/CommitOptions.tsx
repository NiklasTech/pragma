import { useState } from "react";
import { toast } from "sonner";
import { ArrowCounterClockwise, Sparkle, Spinner } from "@phosphor-icons/react";
import { useGitStore, type GitLastCommit } from "@/shared/stores/git";
import { useAIStore } from "@/shared/stores/ai";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { generateCommitMessage } from "../../lib/commitMessage";
import { UndoCommitDialog } from "./UndoCommitDialog";

export function CommitOptions({ stagedCount }: { stagedCount: number }) {
  const repoPath = useGitStore((s) => s.repoPath);
  const actionBusy = useGitStore((s) => s.actionBusy);
  const commitAmend = useGitStore((s) => s.commitAmend);
  const setCommitAmend = useGitStore((s) => s.setCommitAmend);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const loadLastCommit = useGitStore((s) => s.loadLastCommit);
  const undoLastCommit = useGitStore((s) => s.undoLastCommit);

  const activeProvider = useAIStore((s) => s.activeProvider);
  const activeModel = useAIStore((s) => s.activeModel);
  const providers = useAIStore((s) => s.providers);

  const [generating, setGenerating] = useState(false);
  const [undoTarget, setUndoTarget] = useState<GitLastCommit | null>(null);

  const handleGenerate = async () => {
    if (!repoPath) return;
    if (!activeModel) {
      toast.error("Select a model to generate a commit message");
      return;
    }
    setGenerating(true);
    try {
      const message = await generateCommitMessage(
        {
          provider: activeProvider,
          model: activeModel,
          baseUrl: providers[activeProvider].baseUrl,
        },
        repoPath,
      );
      setCommitMessage(message);
    } catch (err) {
      toast.error("Could not generate a commit message", { description: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  const handleUndo = async () => {
    const last = await loadLastCommit();
    if (!last) {
      toast.error("There is no commit to undo.");
      return;
    }
    if (!last.has_parent) {
      toast.error("The first commit of a branch cannot be undone.");
      return;
    }
    setUndoTarget(last);
  };

  const handleConfirmUndo = () => {
    setUndoTarget(null);
    void undoLastCommit();
  };

  return (
    <div className="flex h-6 items-center gap-1">
      <label className="flex items-center gap-1.5 text-ui-xs text-fg-muted">
        <Switch
          size="sm"
          checked={commitAmend}
          disabled={!!actionBusy}
          onCheckedChange={(checked) => void setCommitAmend(checked)}
        />
        Amend
      </label>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Generate commit message"
          aria-label="Generate commit message"
          disabled={stagedCount === 0 || generating || !!actionBusy}
          onClick={() => void handleGenerate()}
        >
          {generating ? <Spinner className="animate-spin" /> : <Sparkle />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Undo last commit"
          aria-label="Undo last commit"
          disabled={!!actionBusy}
          onClick={() => void handleUndo()}
        >
          <ArrowCounterClockwise />
        </Button>
      </div>
      <UndoCommitDialog
        commit={undoTarget}
        onCancel={() => setUndoTarget(null)}
        onConfirm={handleConfirmUndo}
      />
    </div>
  );
}
