import { invoke } from "@tauri-apps/api/core";
import { GitCommit } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

import { useTasksStore } from "@/features/ai/tasks/store";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAIStore } from "@/shared/stores/ai";

import { commitMessageFor } from "./commit";

/** Stages the session's kept changes and commits them with a message prefilled from its task. */
export function ReviewCommit({
  sessionId,
  cwd,
  paths,
}: {
  sessionId: string;
  cwd: string;
  paths: string[];
}) {
  const taskTitle = useTasksStore(
    (state) => state.tasks.find((task) => task.sessionId === sessionId)?.title ?? null,
  );
  const sessionTitle = useAIStore(
    (state) => state.chatSessions.find((session) => session.id === sessionId)?.title ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stage = async () => {
    setBusy(true);
    try {
      await invoke("git_stage", { repoPath: cwd, paths });
      setMessage(commitMessageFor(taskTitle, sessionTitle));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    const trimmed = message?.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await invoke("git_commit", { repoPath: cwd, message: trimmed });
      setMessage(null);
      toast.success("Committed the kept changes");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  };

  if (message === null) {
    return (
      <Button
        variant="ghost"
        size="xs"
        className="text-ui-xs"
        disabled={busy || paths.length === 0}
        title="Stage the kept changes and commit them"
        onClick={() => void stage()}
      >
        <GitCommit size={12} />
        Commit
      </Button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void commit();
      }}
    >
      <Input
        autoFocus
        value={message}
        placeholder="Commit message"
        aria-label="Commit message"
        className="h-7 text-ui-xs"
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMessage(null);
        }}
      />
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-ui-xs"
          onClick={() => setMessage(null)}
        >
          Cancel
        </Button>
        <Button type="submit" size="xs" className="text-ui-xs" disabled={busy || !message.trim()}>
          Commit
        </Button>
      </div>
    </form>
  );
}
