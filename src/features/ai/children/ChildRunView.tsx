import { CircleDashed, Stop } from "@phosphor-icons/react";

import { ApprovalCard } from "@/features/agent/components/ApprovalCard";
import { stepLabel } from "@/features/agent/executor";
import { getMessageText } from "@/shared/lib/ai/protocol";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
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
import { ChildSessionCards, inlineChildIds } from "./ChildSessionCards";
import { stopChildRun } from "./runner";
import { SpawnApprovals } from "./SpawnApprovals";
import { isRunLive, resolveChildApproval, useChildRunsStore } from "./runStore";

/// A child conversation that is working in the background, shown live in its pane.
export function ChildRunView({ sessionId }: { sessionId: string }) {
  const run = useChildRunsStore((state) => state.runs[sessionId]);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const showThinking = useSettingsStore((state) => state.ai.showThinking);

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
        <SpawnApprovals sessionId={sessionId} />

        {run.approvals.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {run.approvals.map((approval) => {
              const { label, detail } = stepLabel(approval.toolName, approval.args);
              return (
                <ApprovalCard
                  key={approval.toolCallId}
                  title={`Allow: ${label}`}
                  detail={detail}
                  description={approval.description}
                  args={detail ? undefined : approval.args}
                  onDeny={() => resolveChildApproval(sessionId, approval.toolCallId, false)}
                  onAllow={() => resolveChildApproval(sessionId, approval.toolCallId, true)}
                />
              );
            })}
          </div>
        )}

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
          <button
            type="button"
            onClick={() => stopChildRun(rootPath, sessionId)}
            aria-label="Stop session"
            title="Stop session"
            className="ml-auto flex h-6 items-center gap-1.5 rounded-full px-2.5 text-ui-xs font-medium text-fg-muted transition-colors outline-none hover:bg-status-error/10 hover:text-status-error focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Stop size={11} weight="fill" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
