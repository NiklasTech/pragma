import { CircleDashed, Stop } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { ApprovalBar } from "@/features/agent/components/ApprovalBar";
import { stepLabel } from "@/features/agent/executor";
import { getMessageText } from "@/shared/lib/ai/protocol";
import { useSettingsStore } from "@/shared/stores/settings";

import { AssistantTimeline } from "../components/AssistantTimeline";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../components/Conversation";
import { Message, MessageContent } from "../components/Message";
import { PulseDot } from "../components/PulseDot";
import { Shimmer } from "../components/Shimmer";
import { SessionApprovals, useHasSessionApprovals } from "../panes/SessionApprovals";
import { ChildSessionCards, inlineChildIds } from "./ChildSessionCards";
import { stopChildRun } from "./runner";
import { isRunLive, resolveChildApproval, useChildRunsStore } from "./runStore";

/// A child conversation that is working in the background, shown live in its pane.
export function ChildRunView({ sessionId }: { sessionId: string }) {
  const run = useChildRunsStore((state) => state.runs[sessionId]);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const sessionAsks = useHasSessionApprovals(sessionId);

  if (!run) return null;
  const live = isRunLive(run);
  const lastId = run.messages[run.messages.length - 1]?.id;

  return (
    <div className="@container flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Conversation className="h-full">
          <ConversationContent>
            {run.messages.map((message) =>
              message.role === "user" ? (
                <Message key={message.id} from="user">
                  <MessageContent>
                    <p className="whitespace-pre-wrap wrap-break-word">{getMessageText(message)}</p>
                  </MessageContent>
                </Message>
              ) : (
                <Message key={message.id} from="assistant">
                  <MessageContent>
                    <AssistantTimeline
                      message={message}
                      streaming={live && message.id === lastId}
                      showThinking={showThinking}
                    />
                  </MessageContent>
                </Message>
              ),
            )}
            <ChildSessionCards parentId={sessionId} shownInline={inlineChildIds(run.messages)} />
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
        <SessionApprovals sessionId={sessionId} takesEnter />

        {run.approvals.map((approval, index) => {
          const { label, detail } = stepLabel(approval.toolName, approval.args);
          return (
            <ApprovalBar
              key={approval.toolCallId}
              title={`The child session wants to ${label.toLowerCase()}`}
              request={detail ?? JSON.stringify(approval.args ?? {})}
              description={approval.description}
              takesEnter={!sessionAsks && index === 0}
              onDeny={() => resolveChildApproval(sessionId, approval.toolCallId, false)}
              onAllow={() => resolveChildApproval(sessionId, approval.toolCallId, true)}
            />
          );
        })}

        <div className="flex h-9 items-center gap-2 rounded-xl border border-border bg-bg-surface pr-1.5 pl-3">
          {run.status === "waiting-approval" ? (
            <>
              <CircleDashed size={12} className="shrink-0 text-status-warning" />
              <span className="text-ui-xs font-medium text-fg-default">Waiting for approval</span>
            </>
          ) : (
            <>
              <PulseDot className="size-3" />
              <Shimmer as="span" className="text-ui-xs font-medium" duration={1.8}>
                Working in the background
              </Shimmer>
            </>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => stopChildRun(sessionId)}
            aria-label="Stop session"
            title="Stop session"
            className="ml-auto h-6 gap-1.5 rounded-full px-2.5 text-ui-xs hover:bg-status-error/10 hover:text-status-error"
          >
            <Stop size={11} weight="fill" />
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
