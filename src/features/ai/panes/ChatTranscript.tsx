"use client";

import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { Conversation, ConversationContent } from "../components/Conversation";
import { Message, MessageContent, MessageResponse } from "../components/Message";

export function ChatTranscript({ sessionId }: { sessionId: string }) {
  const session = useAIStore((state) => state.chatSessions.find((item) => item.id === sessionId));
  const loadSessionMessages = useAIStore((state) => state.loadSessionMessages);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  useEffect(() => {
    if (session && session.messages.length === 0) {
      void loadSessionMessages(rootPath, sessionId);
    }
  }, [session, rootPath, sessionId, loadSessionMessages]);

  const messages = session?.messages ?? [];

  return (
    <Conversation className="h-full">
      <ConversationContent>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-ui-xs text-fg-subtle">No messages yet.</p>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
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
      </ConversationContent>
    </Conversation>
  );
}
