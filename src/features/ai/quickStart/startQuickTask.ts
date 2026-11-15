import { toast } from "sonner";

import type { PresetNode } from "../panes/layoutPresets";
import { openLayoutPreset, type OpenLayoutOptions } from "../panes/openLayoutPreset";
import { createWorktreeEnvironment } from "../worktree/create";
import { taskTabTitle } from "./quickStart";

export type QuickWhere = "worktree" | "here";

export interface QuickStartRequest {
  rootPath: string;
  task: string;
  /** The layout with the chosen agent already in place. */
  layout: PresetNode;
  where: QuickWhere;
  /** The branch a new worktree starts from; unset is the checkout's HEAD. */
  baseBranch?: string;
}

/** Starts a task: an optional worktree named after it, then the layout as a new tab. */
export async function startQuickTask(request: QuickStartRequest): Promise<void> {
  const task = request.task.trim();
  let environment: OpenLayoutOptions["environment"] = { environment: "checkout" };
  if (request.where === "worktree") {
    const worktree = await createWorktreeEnvironment(
      request.rootPath,
      request.baseBranch,
      task || undefined,
    );
    if (worktree.setupStatus !== "ready") {
      const lastLine = worktree.setupLog.trim().split("\n").pop();
      toast.error("The worktree setup script failed", { description: lastLine || undefined });
    }
    environment = { sameEnvironmentAs: { environment: "worktree", environmentId: worktree.id } };
  }
  const name = taskTabTitle(task);
  await openLayoutPreset(
    request.rootPath,
    { id: "quick-start", name, layout: request.layout },
    { tabName: name, environment, task },
  );
}
