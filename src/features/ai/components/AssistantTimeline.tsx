import type { UIMessage } from "@ai-sdk/react";
import { useMemo } from "react";

import { buildAssistantTimeline, taskCompleteSummary, type TimelineItem } from "./timelineItems";
import { MessageResponse } from "./Message";
import { ReasoningBlock } from "./ReasoningBlock";
import { ToolInvocationBlock } from "./ToolInvocationBlock";
import { WorkingIndicator } from "./WorkingIndicator";

interface AssistantTimelineProps {
  message: UIMessage;
  streaming: boolean;
  showThinking: boolean;
}

function isFinishedTool(item: TimelineItem | undefined): boolean {
  return (
    item?.kind === "tool" &&
    (item.invocation.state === "output-available" || item.invocation.state === "output-error")
  );
}

export function AssistantTimeline({ message, streaming, showThinking }: AssistantTimelineProps) {
  const items = useMemo(() => buildAssistantTimeline(message), [message]);
  const last = items[items.length - 1];
  const isWaiting = streaming && (!last || isFinishedTool(last));

  return (
    <>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (item.kind === "reasoning") {
          return (
            <ReasoningBlock
              key={item.key}
              reasoning={item.text}
              streaming={streaming && isLast}
              defaultOpen={showThinking}
            />
          );
        }

        if (item.kind === "text") {
          return (
            <MessageResponse key={item.key} streaming={streaming && isLast}>
              {item.text}
            </MessageResponse>
          );
        }

        const summary = taskCompleteSummary(item.invocation);
        const answeredLater = items.slice(index + 1).some((next) => next.kind === "text");
        if (summary && !answeredLater) {
          return (
            <MessageResponse key={item.key} streaming={false}>
              {summary}
            </MessageResponse>
          );
        }

        return (
          <ToolInvocationBlock
            key={item.key}
            toolCallId={item.invocation.toolCallId}
            toolName={item.invocation.toolName}
            state={item.invocation.state}
            input={item.invocation.input}
            output={item.invocation.output}
            errorText={item.invocation.errorText}
          />
        );
      })}
      {isWaiting && <WorkingIndicator label="Working" />}
    </>
  );
}
