"use client";

import { CheckCircle, XCircle, Spinner } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

interface ToolInvocationBlockProps {
  toolCallId: string;
  toolName: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-streaming"
    | "output-available"
    | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function ToolInvocationBlock({
  toolName,
  state,
  input,
  output,
  errorText,
}: ToolInvocationBlockProps) {
  const isRunning = state === "input-streaming" || state === "output-streaming";
  const isError = state === "output-error";
  const isDone = state === "output-available" || isError;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-ui-sm",
        isError ? "border-status-error/30 bg-status-error/10" : "border-border/60 bg-bg-hover/40",
      )}
    >
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Spinner size={14} className="animate-spin text-primary" />
        ) : isError ? (
          <XCircle size={14} className="text-status-error" />
        ) : (
          <CheckCircle size={14} className="text-status-success" />
        )}
        <span className="font-medium">{toolName}</span>
        {isRunning && <span className="text-ui-xs text-fg-muted">Running...</span>}
      </div>

      {input !== undefined && (
        <div className="text-ui-xs text-fg-muted">
          <span className="font-medium">Input:</span>{" "}
          <code className="rounded bg-bg-hover px-1 py-0.5 font-mono">{formatValue(input)}</code>
        </div>
      )}

      {isDone && (
        <div className="text-ui-xs">
          {isError ? (
            <span className="text-status-error">{errorText ?? "Tool execution failed"}</span>
          ) : (
            <code className="block max-h-32 overflow-auto rounded bg-bg-hover px-2 py-1 font-mono text-fg-muted">
              {formatValue(output)}
            </code>
          )}
        </div>
      )}
    </div>
  );
}
