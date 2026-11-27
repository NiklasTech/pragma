import { useMemo } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { openFileAtLine } from "./openWorkspaceFile";
import { diffCounts, displayPath, lineDiff, type DiffLine, type ToolDiff } from "./toolDetails";

const LINE_CLASS: Record<DiffLine["kind"], string> = {
  added: "bg-status-success/10 text-git-added",
  removed: "bg-status-error/10 text-git-deleted",
  context: "text-fg-muted",
};

const SIGN: Record<DiffLine["kind"], string> = { added: "+", removed: "-", context: " " };

/// A link that opens a file the agent worked on in the editor.
export function FileLink({
  path,
  line,
  root,
}: {
  path: string;
  line: number | null;
  root: string | null;
}) {
  const label = displayPath(path, root);
  return (
    <Button
      variant="link"
      title={`Open ${path}`}
      onClick={() => void openFileAtLine(path, line)}
      className="h-auto min-w-0 justify-start truncate p-0 font-mono text-ui-2xs"
    >
      {line !== null ? `${label}:${line}` : label}
    </Button>
  );
}

function OneDiff({ diff, limit, root }: { diff: ToolDiff; limit: number; root: string | null }) {
  const lines = useMemo(() => lineDiff(diff.oldText, diff.newText), [diff]);
  const { added, removed } = diffCounts(lines);
  const shown = lines.slice(0, limit);
  const hidden = lines.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-2 text-ui-2xs">
        <FileLink path={diff.path} line={null} root={root} />
        {diff.oldText === null && <span className="shrink-0 text-fg-subtle">new file</span>}
        <span className="shrink-0 font-mono text-git-added tabular-nums">+{added}</span>
        <span className="shrink-0 font-mono text-git-deleted tabular-nums">-{removed}</span>
      </div>
      {shown.length > 0 && (
        <div className="flex flex-col overflow-x-auto rounded-md border border-border-subtle font-mono text-ui-2xs leading-relaxed">
          {shown.map((line, index) => (
            <span key={index} className={cn("px-2 whitespace-pre", LINE_CLASS[line.kind])}>
              {SIGN[line.kind]} {line.text}
            </span>
          ))}
        </div>
      )}
      {hidden > 0 && (
        <span className="font-mono text-ui-2xs text-fg-subtle">
          +{hidden} {hidden === 1 ? "line" : "lines"}
        </span>
      )}
    </div>
  );
}

/// The file changes of a tool call as compact diffs; `limit` caps the lines per file.
export function ToolDiffList({
  diffs,
  limit = Number.POSITIVE_INFINITY,
  root,
}: {
  diffs: ToolDiff[];
  limit?: number;
  root: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {diffs.map((diff, index) => (
        <OneDiff key={`${index}:${diff.path}`} diff={diff} limit={limit} root={root} />
      ))}
    </div>
  );
}
