export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  agentId?: string;
  sessionId?: string;
  result: string;
  priority?: TaskPriority;
  labels?: string[];
  /** Ids of tasks that must be done before this one can start. */
  blockedBy?: string[];
  /** GitHub issue the task was imported from. */
  issueUrl?: string;
  issueNumber?: number;
  createdAt: number;
  updatedAt: number;
}
