import { toast } from "sonner";

import { setPendingFirstMessage } from "../home/pendingFirstMessage";

export interface ChatTask {
  sessionId: string;
  prompt: string;
}

/**
 * Hands each new chat its task. One chat sends it itself once its pane shows; of several only one
 * can be live, so they start without their panes and take follow-ups when the first turn is done.
 */
export async function sendChatTasks(rootPath: string, tasks: readonly ChatTask[]): Promise<void> {
  const [first, ...others] = tasks;
  if (!first) return;
  if (others.length === 0) {
    setPendingFirstMessage(first.prompt, first.sessionId);
    return;
  }
  const { startChildRun } = await import("../children/runner");
  for (const task of tasks) {
    try {
      await startChildRun(rootPath, task.sessionId, task.prompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the task");
    }
  }
}
