import { useCallback, useMemo, useState } from "react";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import { toast } from "sonner";

import { getMessageImages } from "@/shared/lib/ai/images";
import { useAIStore, type ChatImage } from "@/shared/stores/ai";

import { forkThread, keepCheckpointsForEdit, restoreRewindFiles, rewindFiles } from "./actions";

interface MessageActionsOptions {
  sessionId: string | null;
  rootPath: string;
  messages: UIMessage[];
  setMessages: UseChatHelpers<UIMessage>["setMessages"];
  submitText: (
    raw: string,
    images: ChatImage[],
    options: { replaceMessageId?: string },
  ) => Promise<boolean>;
}

export function useMessageActions({
  sessionId,
  rootPath,
  messages,
  setMessages,
  submitText,
}: MessageActionsOptions) {
  const [rewindIndex, setRewindIndex] = useState<number | null>(null);

  const rewindTargetFiles = useMemo(
    () =>
      sessionId !== null && rewindIndex !== null
        ? rewindFiles(sessionId, messages, rewindIndex)
        : [],
    [sessionId, messages, rewindIndex],
  );

  const resend = useCallback(
    async (index: number, text: string): Promise<boolean> => {
      const message = messages[index];
      if (!sessionId || !message) return false;
      const sent = await submitText(text, getMessageImages(message), {
        replaceMessageId: message.id,
      });
      if (sent) keepCheckpointsForEdit(sessionId, messages, index);
      return sent;
    },
    [sessionId, messages, submitText],
  );

  const fork = useCallback(
    (index: number) => {
      const source = useAIStore.getState().chatSessions.find((s) => s.id === sessionId);
      if (!source) return;
      forkThread(rootPath, source, messages, index).catch((err: unknown) => {
        toast.error(`Could not fork the thread: ${String(err)}`);
      });
    },
    [sessionId, rootPath, messages],
  );

  const confirmRewind = useCallback(async () => {
    const index = rewindIndex;
    setRewindIndex(null);
    if (!sessionId || index === null) return;
    const failed = await restoreRewindFiles(sessionId, messages, index);
    setMessages(messages.slice(0, index + 1));
    if (failed.length > 0) toast.error(`Could not restore ${failed.join(", ")}`);
  }, [sessionId, messages, rewindIndex, setMessages]);

  return {
    resend,
    fork,
    rewindIndex,
    rewindTargetFiles,
    requestRewind: setRewindIndex,
    cancelRewind: () => setRewindIndex(null),
    confirmRewind,
  };
}
