"use client";

import { useState } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { PencilSimple } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { MessageImages } from "@/features/ai/images/MessageImages";
import { Message, MessageContent } from "@/features/ai/components/Message";

import { MessageActionBar, MessageActionButton } from "./MessageActionBar";

interface EditableUserMessageProps {
  message: UIMessage;
  text: string;
  canEdit: boolean;
  onResend: (text: string) => Promise<boolean>;
}

export function EditableUserMessage({
  message,
  text,
  canEdit,
  onResend,
}: EditableUserMessageProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (draft === null || !draft.trim()) return;
    setSending(true);
    const sent = await onResend(draft);
    setSending(false);
    if (sent) setDraft(null);
  };

  if (draft !== null) {
    return (
      <Message from="user">
        <MessageContent>
          <MessageImages message={message} />
          <Textarea
            autoFocus
            value={draft}
            aria-label="Edit message"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDraft(null);
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-ui-xs text-fg-subtle">
              Sending replaces every later message.
            </span>
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={sending || !canEdit || !draft.trim()}
              onClick={() => void send()}
            >
              Send
            </Button>
          </div>
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message from="user" className="flex-col gap-1">
      <MessageContent>
        <MessageImages message={message} />
        {text && <p className="whitespace-pre-wrap wrap-break-word">{text}</p>}
      </MessageContent>
      {canEdit && (
        <MessageActionBar>
          <MessageActionButton label="Edit message" onClick={() => setDraft(text)}>
            <PencilSimple size={13} />
          </MessageActionButton>
        </MessageActionBar>
      )}
    </Message>
  );
}
