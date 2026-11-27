"use client";

import { CheckCircle, XCircle, Spinner } from "@phosphor-icons/react";

import { imageToFilePart } from "@/shared/lib/ai/images";
import { isToolImageOutput, toolOutputImages } from "@/shared/lib/ai/toolOutput";
import { stepLabel } from "@/features/agent/executor";
import { cn } from "@/shared/lib/utils";

import { ActivityBlock } from "./ActivityBlock";
import { Shimmer } from "./Shimmer";

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
  /** The title a coding CLI gave the call, such as the shell command or the file it reads. */
  title?: string;
  /** Whether the message is still streaming; a call waiting for its output then counts as running. */
  active?: boolean;
}

const PREVIEW_LINES = 3;

function formatValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (isToolImageOutput(value)) return value.text;
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

/// The CLI title without the tool name it repeats, e.g. "Read src/a.ts" -> "src/a.ts".
export function titleDetail(
  title: string | undefined,
  toolName: string,
  label: string,
): string | undefined {
  const text = title?.replace(/`/g, "").trim();
  if (!text || text === toolName || text === label) return undefined;
  for (const prefix of [toolName, label]) {
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim();
  }
  return text;
}

/// The first lines of a tool's output and how many lines stay hidden.
export function outputPreview(text: string): { lines: string[]; hidden: number } {
  const all = text.replace(/\s+$/, "").split("\n");
  if (all.length === 1 && all[0] === "") return { lines: [], hidden: 0 };
  return { lines: all.slice(0, PREVIEW_LINES), hidden: Math.max(0, all.length - PREVIEW_LINES) };
}

const PRE_CLASS =
  "mt-1 max-w-full overflow-x-auto rounded-md border border-border-subtle bg-bg-root px-2.5 py-2 font-mono text-ui-2xs leading-relaxed whitespace-pre-wrap text-fg-muted";

export function ToolInvocationBlock({
  toolName,
  state,
  input,
  output,
  errorText,
  title: cliTitle,
  active = false,
}: ToolInvocationBlockProps) {
  const isStreaming = state === "input-streaming" || state === "output-streaming";
  const isRunning = isStreaming || (active && state === "input-available");
  const isError = state === "output-error";
  const isDone = state === "output-available" || isError;

  const known = stepLabel(toolName, input);
  const label = known.label === toolName ? humanizeToolName(toolName) : known.label;
  const detail = known.detail ?? titleDetail(cliTitle, toolName, label);
  const preview = isDone
    ? outputPreview(isError ? (errorText ?? "Tool execution failed") : formatValue(output))
    : null;

  const icon = isRunning ? (
    <Spinner size={13} className="animate-spin text-primary" />
  ) : isError ? (
    <XCircle
      size={13}
      weight="fill"
      className="animate-in text-status-error duration-200 zoom-in-50 motion-reduce:animate-none"
    />
  ) : (
    <CheckCircle
      size={13}
      weight="fill"
      className="animate-in text-fg-subtle duration-200 zoom-in-50 motion-reduce:animate-none"
    />
  );

  const title = (
    <>
      {isRunning ? (
        <Shimmer as="span" className="shrink-0 font-medium" duration={1.4}>
          {label}
        </Shimmer>
      ) : (
        <span className="shrink-0 font-medium text-fg-default">{label}</span>
      )}
      {detail && (
        <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-muted">{detail}</span>
      )}
    </>
  );

  return (
    <ActivityBlock
      icon={icon}
      title={title}
      hint={toolName}
      streaming={isRunning}
      defaultOpen={isStreaming}
      preview={
        preview && preview.lines.length > 0 ? (
          <div
            className={cn(
              "flex flex-col font-mono text-ui-2xs leading-relaxed",
              isError ? "text-status-error" : "text-fg-muted",
            )}
          >
            {preview.lines.map((line, index) => (
              <span key={index} className="truncate whitespace-pre">
                {line || " "}
              </span>
            ))}
            {preview.hidden > 0 && (
              <span className="text-fg-subtle">
                +{preview.hidden} {preview.hidden === 1 ? "line" : "lines"}
              </span>
            )}
          </div>
        ) : undefined
      }
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
              <>
                <pre className={PRE_CLASS}>{formatValue(output)}</pre>
                {toolOutputImages(output).map((image, index) => (
                  <img
                    key={index}
                    src={imageToFilePart(image).url}
                    alt={`Tool result image ${index + 1}`}
                    className="mt-2 max-h-60 max-w-full rounded-md border border-border-subtle object-contain"
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </ActivityBlock>
  );
}
