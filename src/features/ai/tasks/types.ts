export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  agentId?: string;
  sessionId?: string;
  result: string;
  createdAt: number;
  updatedAt: number;
}
