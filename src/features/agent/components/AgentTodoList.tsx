import { CheckCircle, Circle, CircleNotch, ListChecks } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

import { useAgentStore, type AgentTodo, type AgentTodoStatus } from "../store";

function TodoIcon({ status }: { status: AgentTodoStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle size={13} weight="fill" className="shrink-0 text-status-success" />;
    case "in_progress":
      return <CircleNotch size={13} className="shrink-0 animate-spin text-primary" />;
    case "pending":
      return <Circle size={13} className="shrink-0 text-fg-subtle" />;
  }
}

function TodoRow({ todo }: { todo: AgentTodo }) {
  return (
    <div className="flex items-start gap-2 px-3 py-1">
      <div className="mt-0.5">
        <TodoIcon status={todo.status} />
      </div>
      <span
        className={cn(
          "text-ui-xs break-words",
          todo.status === "done" && "text-fg-subtle line-through",
          todo.status === "in_progress" && "font-medium text-fg-default",
          todo.status === "pending" && "text-fg-muted",
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
    <div className="flex flex-col border-t border-border-subtle py-1.5">
      <div className="flex items-center gap-1.5 px-3 pb-0.5 text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
        <ListChecks size={12} className="shrink-0" />
        Todos
        <span className="ml-auto font-normal tracking-normal normal-case tabular-nums">
          {todos.filter((todo) => todo.status === "done").length}/{todos.length}
        </span>
      </div>
      <div className="mt-0.5 flex flex-col">
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </div>
    </div>
  );
}
