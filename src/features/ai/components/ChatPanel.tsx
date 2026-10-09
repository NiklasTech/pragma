import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  Warning,
  Terminal,
  Robot,
  ArrowCounterClockwise,
  ArrowsInLineVertical,
  ClockCounterClockwise,
  GitFork,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAI, getMessageText } from "@/shared/hooks/useAI";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { extractFirstCodeBlock } from "@/shared/lib/extract-code-block";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import type { UIMessage } from "@ai-sdk/react";

import { AgentApprovals } from "@/features/agent/components/AgentApprovals";
import { ApprovalCard } from "@/features/agent/components/ApprovalCard";
import { useAgentStore } from "@/features/agent/store";
import { useSteerQueue } from "@/features/ai/steer/useSteerQueue";
import { QueuedMessageCard } from "@/features/ai/steer/QueuedMessageCard";
import { useSessionRunReporter } from "@/features/ai/tasks/sessionRuns";
import { SpawnApprovals } from "@/features/ai/children/SpawnApprovals";
import { ChildSessionCards, inlineChildIds } from "@/features/ai/children/ChildSessionCards";
import { useComposerImages } from "@/features/ai/images/useComposerImages";
import { CompactionMarker } from "@/features/ai/compaction/CompactionMarker";
import { useCompactionStore } from "@/features/ai/compaction/compactSession";
import { compactionSummary, isCompactionMessage } from "@/shared/lib/ai/compaction";
import { EditableUserMessage } from "@/features/ai/rewind/EditableUserMessage";
import { MessageActionBar, MessageActionButton } from "@/features/ai/rewind/MessageActionBar";
import { RewindDialog } from "@/features/ai/rewind/RewindDialog";
import { useMessageActions } from "@/features/ai/rewind/useMessageActions";
import { useScrollToJumpTarget } from "@/features/ai/search/useScrollToJumpTarget";
import { CopyMessageButton } from "@/features/ai/export/CopyMessageButton";
import { parseFencedBlocks, resolveApplyTargets } from "../context/applyTargets";
import { AgentRunBar } from "./AgentRunBar";
import { AssistantTimeline } from "./AssistantTimeline";
import { splitInlineReasoning } from "./timelineItems";
import { ChatApplyProvider } from "./ChatApplyContext";
import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { ContextAttachments } from "./ContextAttachments";
import { Conversation, ConversationContent, ConversationScrollButton } from "./Conversation";
import { Message, MessageContent } from "./Message";
import { SourceBlock } from "./SourceBlock";
import { WorkingIndicator } from "./WorkingIndicator";

export interface ChatPanelProps {
  hideHeader?: boolean;
}

export function ChatPanel({ hideHeader = false }: ChatPanelProps) {
  const {
    messages,
    input,
    setInput,
    submitText,
    isLoading,
    status,
    error,
    regenerate,
    setMessages,
    stop,
    canChat,
    isCLIActive,
    activeCLIProvider,
    mcpLoaded,
    lastAttachments,
    lastContextTruncated,
  } = useAI();
  const cliStatuses = useAIStore((state) => state.cliStatuses);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const activeSession = chatSessions.find((session) => session.id === activeChatSessionId);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const setupLog =
    activeSession?.worktree?.status === "error" ? activeSession.worktree.setupLog : null;
  const edit = useAIEditStore((state) => state.edit);
  const receiveProposal = useAIEditStore((state) => state.receiveProposal);
  const cancelEdit = useAIEditStore((state) => state.cancelEdit);
  const openDiff = useEditorStore((state) => state.openDiff);
  // Keyed on tab identity only; applyChatCodeBlock reads live content, so typing skips chat renders.
  const openFilesKey = useEditorStore((state) =>
    state.tabs
      .filter((tab) => tab.kind === "file")
      .map((tab) => `${tab.id}\0${tab.path}\0${tab.name}`)
      .join("\n"),
  );
  const activePath = useEditorStore((state) => {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);
    return active && active.kind === "file" ? active.path : null;
  });
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const [pendingApprovals, setPendingApprovals] = useState<
    Array<{
      sessionId: string;
      toolCallId: string;
      toolName: string;
      args?: unknown;
      description?: string;
    }>
  >([]);

  const compacting = useCompactionStore((state) =>
    activeChatSessionId ? state.running[activeChatSessionId] === true : false,
  );
  const cliStatus = activeCLIProvider ? cliStatuses[activeCLIProvider] : null;
  const composerImages = useComposerImages();

  const ownsRun =
    activeChatSessionId !== null &&
    runSessionId === activeChatSessionId &&
    (agentStatus === "running" || agentStatus === "waiting-approval");
  const inFlight = status === "submitted" || status === "streaming" || ownsRun;

  const {
    queued,
    enqueue,
    remove,
    stop: handleStop,
  } = useSteerQueue({
    sessionId: activeChatSessionId,
    ownsRun,
    inFlight,
    chatFailed: status === "error",
    runFailed: agentStatus === "error" || agentStatus === "cancelled",
    submitText,
    stopChat: stop,
  });

  const stopRun = useSessionRunReporter({
    sessionId: activeChatSessionId,
    inFlight,
    chatFailed: status === "error",
    isCLIActive,
    stop: handleStop,
    submitText,
  });

  const messageActions = useMessageActions({
    sessionId: activeChatSessionId,
    rootPath: rootPath ?? "default",
    messages,
    setMessages,
    submitText,
  });
  const canActOnMessages = activeChatSessionId !== null && !isCLIActive && !inFlight && !compacting;
  const messageIds = useMemo(() => messages.map((message) => message.id), [messages]);
  useScrollToJumpTarget(activeChatSessionId, messageIds);

  const openFiles = useMemo(
    () =>
      useEditorStore
        .getState()
        .tabs.filter((tab): tab is FileTab => tab.kind === "file")
        .map((tab) => ({ id: tab.id, path: tab.path, name: tab.name, content: tab.content })),
    [openFilesKey],
  );

  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;

    if (
      (previous === "streaming" || previous === "submitted") &&
      status === "ready" &&
      edit?.status === "awaiting"
    ) {
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (!lastAssistant) {
        cancelEdit();
        return;
      }

      const text = getMessageText(lastAssistant);
      const codeBlock = extractFirstCodeBlock(text);

      if (!codeBlock) {
        cancelEdit();
        return;
      }

      receiveProposal(codeBlock.code);

      const fileName = edit.filePath.split("/").pop() ?? edit.filePath;
      openDiff({
        id: `ai-edit:${edit.fileTabId}:${Date.now()}`,
        path: edit.filePath,
        original: edit.originalCode,
        modified: codeBlock.code,
        patchText: "",
        staged: false,
        sourceTabId: edit.fileTabId,
        name: `${fileName} (AI Edit)`,
      });
    }
  }, [status, edit, messages, receiveProposal, cancelEdit, openDiff]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      unlisten = await listen<
        Array<{
          sessionId: string;
          toolCallId: string;
          toolName: string;
          args?: unknown;
          description?: string;
        }>[number]
      >("acp_request_permission", (event) => {
        setPendingApprovals((prev) => [...prev, event.payload]);
      });
      if (!active) {
        void unlistenQuietly(unlisten);
        unlisten = undefined;
      }
    })();

    return () => {
      active = false;
      void unlistenQuietly(unlisten);
    };
  }, []);

  const handleApproval = useCallback(async (toolCallId: string, approved: boolean) => {
    await invoke("cli_acp_approve", { req: { tool_call_id: toolCallId, approved } });
    setPendingApprovals((prev) => prev.filter((a) => a.toolCallId !== toolCallId));
  }, []);

  // Auto-approve pending tool requests when Yolo mode is enabled.
  useEffect(() => {
    if (!yoloMode || pendingApprovals.length === 0) return;

    for (const approval of pendingApprovals) {
      void handleApproval(approval.toolCallId, true);
    }
  }, [yoloMode, pendingApprovals, handleApproval]);

  const handleRetry = useCallback(() => {
    void regenerate();
  }, [regenerate]);

  const handleComposerSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const { images, clear: clearImages } = composerImages;
      if (inFlight) {
        if (images.length > 0) {
          toast.info("Images can be sent once the current response has finished.");
          return;
        }
        const result = enqueue(input);
        if (result.accepted) setInput(result.restore ?? "");
        return;
      }
      void submitText(input, images).then((sent) => {
        if (!sent) return;
        setInput("");
        clearImages();
      });
    },
    [composerImages, enqueue, inFlight, input, setInput, submitText],
  );

  const streamingMessageId =
    status === "streaming" && messages[messages.length - 1]?.role === "assistant"
      ? messages[messages.length - 1]?.id
      : null;

  const cliStatusText = cliStatus
    ? `Using ${cliStatus.provider_id} via CLI${cliStatus.user ? ` — ${cliStatus.user}` : ""}`
    : "";

  return (
    <div className="@container flex h-full flex-col">
      {!hideHeader && <ChatPanelHeader />}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && <ChatEmptyState />}

            {messages.map((msg: UIMessage, messageIndex) => {
              if (isCompactionMessage(msg)) {
                return <CompactionMarker key={msg.id} summary={compactionSummary(msg)} />;
              }
              const rawText = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              const sourceDocuments = msg.parts.filter(
                (p) => p.type === "source-document",
              ) as Array<{
                type: "source-document";
                title: string;
                filename?: string;
              }>;
              const sourceUrls = msg.parts.filter((p) => p.type === "source-url") as Array<{
                type: "source-url";
                url: string;
                title?: string;
              }>;
              const isStreaming = msg.id === streamingMessageId;
              const text = splitInlineReasoning(rawText)
                .filter((segment) => segment.kind === "text")
                .map((segment) => segment.text)
                .join("")
                .trim();

              if (msg.role === "user") {
                return (
                  <EditableUserMessage
                    key={msg.id}
                    message={msg}
                    text={rawText}
                    canEdit={canActOnMessages}
                    onResend={(next) => messageActions.resend(messageIndex, next)}
                  />
                );
              }

              const applyTargets = resolveApplyTargets({
                messageText: text,
                blocks: parseFencedBlocks(text),
                openFiles,
                activePath,
                rootPath,
              });

              return (
                <Message
                  key={msg.id}
                  from="assistant"
                  className="flex-col gap-1"
                  data-message-id={msg.id}
                >
                  <MessageContent>
                    {sourceDocuments.map((source, index) => (
                      <SourceBlock
                        key={`${msg.id}-doc-${index}`}
                        type="document"
                        title={source.title}
                        filename={source.filename}
                        streaming={isStreaming}
                      />
                    ))}
                    {sourceUrls.map((source, index) => (
                      <SourceBlock
                        key={`${msg.id}-url-${index}`}
                        type="url"
                        title={source.title ?? source.url}
                        url={source.url}
                        streaming={isStreaming}
                      />
                    ))}
                    <ChatApplyProvider targets={applyTargets}>
                      <AssistantTimeline
                        message={msg}
                        streaming={isStreaming}
                        showThinking={showThinking}
                      />
                    </ChatApplyProvider>
                  </MessageContent>
                  <MessageActionBar>
                    {!isStreaming && <CopyMessageButton message={msg} />}
                    {canActOnMessages && (
                      <MessageActionButton
                        label="Fork from here"
                        onClick={() => messageActions.fork(messageIndex)}
                      >
                        <GitFork size={13} />
                      </MessageActionButton>
                    )}
                    {canActOnMessages && messageIndex < messages.length - 1 && (
                      <MessageActionButton
                        label="Rewind to here"
                        onClick={() => messageActions.requestRewind(messageIndex)}
                      >
                        <ClockCounterClockwise size={13} />
                      </MessageActionButton>
                    )}
                  </MessageActionBar>
                </Message>
              );
            })}

            <ChildSessionCards
              parentId={activeChatSessionId}
              shownInline={inlineChildIds(messages)}
            />

            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <WorkingIndicator label="Thinking" />
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <RewindDialog
          open={messageActions.rewindIndex !== null}
          removedMessages={messages.length - 1 - (messageActions.rewindIndex ?? 0)}
          files={messageActions.rewindTargetFiles}
          onOpenChange={(open) => {
            if (!open) messageActions.cancelRewind();
          }}
          onConfirm={() => void messageActions.confirmRewind()}
        />
      </div>

      {/* Footer */}
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
        {/* Error Banner */}
        {error && (
          <Alert variant="destructive" className="mb-2">
            <Warning size={16} />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="text-ui-base">{error.message}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <ArrowCounterClockwise size={12} weight="bold" />
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}

        {setupLog && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-status-error/30 bg-status-error/5 px-3 py-2 text-ui-xs text-status-error">
            <Warning size={14} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{setupLog}</span>
          </div>
        )}

        {/* Status Banner */}
        {isCLIActive && cliStatus && (
          <div className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-ui-xs text-fg-muted">
            <Terminal size={13} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate" title={cliStatusText}>
              {cliStatusText}
            </span>
          </div>
        )}

        {!mcpLoaded && (
          <div className="mb-2 flex w-fit items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-ui-xs text-fg-subtle">
            <Robot size={12} className="animate-pulse" />
            <span>Loading MCP tools...</span>
          </div>
        )}

        {compacting && (
          <div className="mb-2 flex w-fit items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-ui-xs text-fg-subtle">
            <ArrowsInLineVertical size={12} className="animate-pulse" />
            <span>Compacting the conversation...</span>
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.toolCallId}
                title={`Allow: ${approval.toolName}`}
                description={approval.description}
                args={approval.args}
                onDeny={() => void handleApproval(approval.toolCallId, false)}
                onAllow={() => void handleApproval(approval.toolCallId, true)}
              />
            ))}
          </div>
        )}

        <SpawnApprovals sessionId={activeChatSessionId} />

        {ownsRun && <AgentApprovals />}

        {!isCLIActive && ownsRun && <AgentRunBar />}

        <ContextAttachments attachments={lastAttachments} truncated={lastContextTruncated} />

        {queued && <QueuedMessageCard text={queued} onRemove={remove} />}

        <ChatComposer
          input={input}
          onInputChange={setInput}
          onSubmit={handleComposerSubmit}
          isLoading={isLoading}
          isStreaming={status === "streaming"}
          inFlight={inFlight}
          canChat={canChat}
          mcpLoaded={mcpLoaded}
          onStop={stopRun}
          images={composerImages.images}
          onAddImages={composerImages.addFiles}
          onRemoveImage={composerImages.remove}
        />
      </div>
    </div>
  );
}
