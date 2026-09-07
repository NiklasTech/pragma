import { Check, Circle, CircleDashed, ListChecks } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

import { useAgentStore, type AgentTodo, type AgentTodoStatus } from "../store";

function TodoIcon({ status }: { status: AgentTodoStatus }) {
  switch (status) {
    case "done":
      return <Check size={12} weight="bold" className="shrink-0 text-status-success" />;
    case "in_progress":
      return <CircleDashed size={12} className="shrink-0 text-status-warning" />;
    case "pending":
      return <Circle size={12} className="shrink-0 text-fg-muted" />;
  }
}

function TodoRow({ todo }: { todo: AgentTodo }) {
  return (
    <div className="flex items-start gap-1.5 pl-4 pr-3 py-0.5">
      <div className="mt-0.5">
        <TodoIcon status={todo.status} />
      </div>
      <span
        className={cn(
          "text-ui-xs break-words",
          todo.status === "done" ? "text-fg-subtle line-through" : "text-fg-default",
        )}
      >
        {todo.content}
      </span>
    </div>
  );
}

export function AgentTodoList() {
  const todos = useAgentStore((state) => state.todos);
  if (todos.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 border-b border-border/40 py-1.5">
      <div className="flex items-center gap-1.5 px-3 text-ui-xs font-medium text-fg-default">
        <ListChecks size={13} className="shrink-0" />
        Todos
      </div>
      <div className="mt-0.5 flex flex-col">
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </div>
    </div>
  );
}
