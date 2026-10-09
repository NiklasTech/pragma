"use client";

import { useEffect, useMemo, useState } from "react";
import { LinkBreak } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAIStore } from "@/shared/stores/ai";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";

import { dependentTaskIds, parseLabels, validateLabels } from "./organize";
import { useTasksStore } from "./store";
import { TaskOrganizeFields } from "./TaskOrganizeFields";
import type { Task, TaskPriority, TaskStatus } from "./types";
import {
  TASK_COLUMNS,
  TASK_NOTES_MAX,
  TASK_RESULT_MAX,
  TASK_TITLE_MAX,
  validateTaskFields,
} from "./validation";

const BUILTIN_AGENT = "builtin";

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}

export function TaskDialog({ open, task, onOpenChange }: TaskDialogProps) {
  const agents = useNamedAgentsStore((state) => state.agents);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const saveTask = useTasksStore((state) => state.saveTask);
  const tasks = useTasksStore((state) => state.tasks);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [agentId, setAgentId] = useState<string>(BUILTIN_AGENT);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [result, setResult] = useState("");
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [labels, setLabels] = useState("");
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setStatus(task?.status ?? "todo");
    setAgentId(task?.agentId ?? BUILTIN_AGENT);
    setSessionId(task?.sessionId);
    setResult(task?.result ?? "");
    setPriority(task?.priority);
    setLabels((task?.labels ?? []).join(", "));
    setBlockedBy(task?.blockedBy ?? []);
    setError(null);
  }, [open, task]);

  const linkedSession = sessionId
    ? chatSessions.find((session) => session.id === sessionId)
    : undefined;
  const agentLabel =
    agentId === BUILTIN_AGENT
      ? "Built-in agent"
      : (agents.find((agent) => agent.id === agentId)?.name ?? "Missing agent");

  const blockerCandidates = useMemo(() => {
    if (!task) return tasks;
    const dependents = dependentTaskIds(task.id, tasks);
    return tasks.filter((other) => other.id !== task.id && !dependents.has(other.id));
  }, [task, tasks]);

  const handleSave = async () => {
    const parsedLabels = parseLabels(labels);
    const failure = validateTaskFields({ title, notes, result }) ?? validateLabels(parsedLabels);
    if (failure) {
      setError(failure);
      return;
    }

    const now = Date.now();
    const saved: Task = {
      id: task?.id ?? crypto.randomUUID(),
      title: title.trim(),
      notes,
      status,
      result,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
    };
    if (agentId !== BUILTIN_AGENT) saved.agentId = agentId;
    if (priority) saved.priority = priority;
    if (parsedLabels.length > 0) saved.labels = parsedLabels;
    const blockers = blockedBy.filter((id) => blockerCandidates.some((other) => other.id === id));
    if (blockers.length > 0) saved.blockedBy = blockers;
    if (sessionId) saved.sessionId = sessionId;

    setSaving(true);
    try {
      await saveTask(saved);
      onOpenChange(false);
    } catch {
      toast.error("Could not save the task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ui-md">{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <form
          id="task-form"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Title</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TASK_TITLE_MAX}
              placeholder="What should be done"
              className="text-ui-sm"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Notes</span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={TASK_NOTES_MAX}
              rows={5}
              placeholder="Details, constraints, links"
              className="text-ui-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-ui-xs font-medium text-fg-muted">Status</span>
              <Select
                value={status}
                onValueChange={(value) => {
                  const column = TASK_COLUMNS.find((item) => item.status === value);
                  if (column) setStatus(column.status);
                }}
              >
                <SelectTrigger aria-label="Status">
                  <SelectValue>
                    {TASK_COLUMNS.find((item) => item.status === status)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_COLUMNS.map((column) => (
                    <SelectItem key={column.status} value={column.status}>
                      {column.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-ui-xs font-medium text-fg-muted">Agent</span>
              <Select
                value={agentId}
                onValueChange={(value) => {
                  if (typeof value === "string") setAgentId(value);
                }}
              >
                <SelectTrigger aria-label="Agent">
                  <SelectValue>{agentLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BUILTIN_AGENT}>Built-in agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TaskOrganizeFields
            priority={priority}
            onPriorityChange={setPriority}
            labels={labels}
            onLabelsChange={setLabels}
            blockedBy={blockedBy}
            onBlockedByChange={setBlockedBy}
            candidates={blockerCandidates}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Result</span>
            <Textarea
              value={result}
              onChange={(event) => setResult(event.target.value)}
              maxLength={TASK_RESULT_MAX}
              rows={3}
              placeholder="What came out of the work"
              className="text-ui-sm"
            />
          </label>

          {sessionId && (
            <div className="flex items-center gap-2 rounded-md border border-border-subtle px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-muted">
                Session: {linkedSession?.title ?? "No longer available"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSessionId(undefined)}
              >
                <LinkBreak size={13} />
                Remove link
              </Button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-ui-xs text-status-error">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
