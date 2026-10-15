import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";
import { useRepositoryGitStore } from "@/shared/stores/repositoryGit";

import { statusLetter } from "./FileRow";
import { basename, dirname } from "./utils";

/// Changes of a repository that is not active, with staging and a commit box.
export function RepositoryChangesDetails({ rootPath }: { rootPath: string }) {
  const status = useRepositoryGitStore((state) => state.byRoot[rootPath]);
  const stage = useRepositoryGitStore((state) => state.stage);
  const unstage = useRepositoryGitStore((state) => state.unstage);
  const commit = useRepositoryGitStore((state) => state.commit);
  const [message, setMessage] = useState("");

  const entries = status?.snapshot?.changed_files ?? [];
  const busy = status?.busy ?? false;
  const stagedCount = entries.filter((entry) => entry.is_staged).length;
  const unstaged = entries.filter((entry) => entry.is_unstaged || !entry.is_staged);

  const handleCommit = async () => {
    if (await commit(rootPath, message)) setMessage("");
  };

  if (!status?.snapshot) {
    return (
      <p className="px-3 py-1.5 text-ui-xs text-fg-subtle">
        {status?.error ?? (status?.loading ? "Loading changes..." : "Not a git repository")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2">
      {status.error && <p className="px-1 text-ui-xs text-status-error">{status.error}</p>}
      {entries.length === 0 ? (
        <p className="px-1 text-ui-xs text-fg-subtle">No changes</p>
      ) : (
        <>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="xs"
              disabled={busy || unstaged.length === 0}
              onClick={() =>
                void stage(
                  rootPath,
                  unstaged.map((entry) => entry.path),
                )
              }
            >
              Stage all
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={busy || stagedCount === 0}
              onClick={() =>
                void unstage(
                  rootPath,
                  entries.filter((entry) => entry.is_staged).map((entry) => entry.path),
                )
              }
            >
              Unstage all
            </Button>
          </div>
          <div className="flex max-h-48 flex-col overflow-y-auto">
            {entries.map((entry) => {
              const letter = statusLetter(entry.status_code);
              const staged = entry.is_staged && !entry.is_unstaged;
              return (
                <label
                  key={entry.path}
                  title={entry.path}
                  className="flex h-6 cursor-pointer items-center gap-2 rounded px-1 text-ui-xs hover:bg-bg-hover"
                >
                  <Checkbox
                    checked={staged}
                    disabled={busy || entry.is_conflicted}
                    aria-label={`${staged ? "Unstage" : "Stage"} ${entry.path}`}
                    onCheckedChange={() => void (staged ? unstage : stage)(rootPath, [entry.path])}
                  />
                  <span className="min-w-0 truncate text-fg-default">{basename(entry.path)}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-subtle">
                    {dirname(entry.path)}
                  </span>
                  <span className={`shrink-0 font-mono font-semibold ${letter.className}`}>
                    {letter.text}
                  </span>
                </label>
              );
            })}
          </div>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Commit message"
            aria-label="Commit message"
            rows={2}
            className="text-ui-xs"
          />
          <Button
            size="sm"
            disabled={busy || stagedCount === 0 || !message.trim()}
            onClick={() => void handleCommit()}
          >
            Commit {stagedCount > 0 ? `${stagedCount} file${stagedCount === 1 ? "" : "s"}` : ""}
          </Button>
        </>
      )}
    </div>
  );
}
