"use client";

import { CheckCircle, XCircle, Spinner } from "@phosphor-icons/react";

import { stepLabel } from "@/features/agent/executor";

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

function humanizeToolName(name: string): string {
  const words = name
    .replace(/^(agent|mcp)_/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\-\s.]+/)
    .filter(Boolean);
  if (words.length === 0) return name;
  const sentence = words.join(" ").toLowerCase();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const PRE_CLASS =
  "mt-1 max-w-full overflow-x-auto rounded-md border border-border-subtle bg-bg-root px-2.5 py-2 font-mono text-ui-2xs leading-relaxed whitespace-pre-wrap text-fg-muted";

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

  const known = stepLabel(toolName, input);
  const label = known.label === toolName ? humanizeToolName(toolName) : known.label;

  const icon = isRunning ? (
    <Spinner size={13} className="animate-spin text-primary" />
  ) : isError ? (
    <XCircle size={13} weight="fill" className="text-status-error" />
  ) : (
    <CheckCircle size={13} weight="fill" className="text-fg-subtle" />
  );

  const title = (
    <>
      <span className="shrink-0 font-medium text-fg-default">{label}</span>
      {known.detail && (
        <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-subtle">
          {known.detail}
        </span>
      )}
    </>
  );

  return (
    <ActivityBlock
      icon={icon}
      title={title}
      hint={toolName}
      streaming={isRunning}
      defaultOpen={isRunning}
    >
      <div className="flex flex-col gap-2.5 text-ui-xs">
        {input !== undefined && (
          <div>
            <span className="text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
              Input
            </span>
            <pre className={PRE_CLASS}>{formatValue(input)}</pre>
          </div>
        )}

        {isDone && (
          <div>
            <span className="text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
              Output
            </span>
            {isError ? (
              <p className="mt-1 text-status-error">{errorText ?? "Tool execution failed"}</p>
            ) : (
              <pre className={PRE_CLASS}>{formatValue(output)}</pre>
            )}
          </div>
        )}
      </div>
    </ActivityBlock>
  );
}
