export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type TaskFrequency = "daily" | "weekly";

/** Local time a task starts on its own while Pragma is open. */
export interface TaskSchedule {
  frequency: TaskFrequency;
  hour: number;
  minute: number;
  /** 0 is Sunday; set only for weekly schedules. */
  weekday?: number;
  paused?: boolean;
}

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
  schedule?: TaskSchedule;
  createdAt: number;
  updatedAt: number;
}
