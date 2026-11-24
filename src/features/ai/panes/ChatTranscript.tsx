"use client";

import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";

import { Conversation, ConversationContent } from "../components/Conversation";
import { Message, MessageContent, MessageResponse } from "../components/Message";
import { ChildSessionCards } from "../children/ChildSessionCards";
import { CompactionMarker } from "../compaction/CompactionMarker";
import { WorkingIndicator } from "../components/WorkingIndicator";
import { useBackgroundChatsStore } from "../live/backgroundChats";
import { SessionApprovals } from "./SessionApprovals";

export function ChatTranscript({ sessionId }: { sessionId: string }) {
  const session = useAIStore((state) => state.chatSessions.find((item) => item.id === sessionId));
  const loadSessionMessages = useAIStore((state) => state.loadSessionMessages);

  const running = useBackgroundChatsStore((state) => state.running.includes(sessionId));

  useEffect(() => {
    if (session && session.messages.length === 0) {
      void loadSessionMessages(sessionId);
    }
  }, [session, sessionId, loadSessionMessages]);

  const messages = session?.messages ?? [];

  return (
    <div className="flex h-full flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <p className="py-8 text-center text-ui-xs text-fg-subtle">No messages yet.</p>
          ) : (
            messages.map((message) =>
              message.kind === "compaction" ? (
                <CompactionMarker key={message.id} summary={message.content} />
              ) : message.role === "user" ? (
                <Message key={message.id} from="user">
                  <MessageContent>
                    <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
                  </MessageContent>
                </Message>
              ) : (
                <Message key={message.id} from="assistant">
                  <MessageContent>
                    <MessageResponse streaming={false}>{message.content}</MessageResponse>
                  </MessageContent>
                </Message>
              ),
            )
          )}
          {running && (
            <Message from="assistant">
              <MessageContent>
                <WorkingIndicator label="Working" />
              </MessageContent>
            </Message>
          )}
          <ChildSessionCards parentId={sessionId} />
        </ConversationContent>
      </Conversation>
      <div className="shrink-0 px-3">
        <SessionApprovals sessionId={sessionId} takesEnter={false} />
      </div>
    </div>
  );
}
