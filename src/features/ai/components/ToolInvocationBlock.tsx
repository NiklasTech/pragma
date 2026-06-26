"use client";

import { CheckCircle, XCircle, Spinner } from "@phosphor-icons/react";

import { ActivityBlock } from "./ActivityBlock";

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

  const icon = isRunning ? (
    <Spinner size={12} className="animate-spin text-primary" />
  ) : isError ? (
    <XCircle size={12} className="text-status-error" />
  ) : (
    <CheckCircle size={12} className="text-status-success" />
  );

  const title = (
    <span className="flex items-center gap-2">
      <span className="font-medium">{toolName}</span>
      {isRunning && <span className="text-ui-xs text-fg-muted">Running...</span>}
    </span>
  );

  return (
    <ActivityBlock icon={icon} title={title} streaming={isRunning} defaultOpen={isRunning}>
      <div className="flex flex-col gap-2 text-ui-xs">
        {input !== undefined && (
          <div>
            <span className="font-medium text-fg-muted">Input</span>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-bg-hover px-2 py-1.5 font-mono text-fg-muted">
              {formatValue(input)}
            </pre>
          </div>
        )}

        {isDone && (
          <div>
            <span className="font-medium text-fg-muted">Output</span>
            {isError ? (
              <p className="mt-1 text-status-error">{errorText ?? "Tool execution failed"}</p>
            ) : (
              <pre className="mt-1 whitespace-pre-wrap rounded bg-bg-hover px-2 py-1.5 font-mono text-fg-muted">
                {formatValue(output)}
              </pre>
            )}
          </div>
        )}
      </div>
    </ActivityBlock>
  );
}
