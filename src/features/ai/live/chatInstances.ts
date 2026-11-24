import { useEffect, useLayoutEffect, useMemo } from "react";
import { Chat, type UIMessage } from "@ai-sdk/react";
import type { ChatInit, ChatTransport } from "ai";

import { notifySessionFinished } from "@/features/extensions/events";
import { uiMessageToStored } from "@/shared/lib/ai/protocol";
import { useAIStore } from "@/shared/stores/ai";

import { reportSessionOutcome } from "../notifications/outcomes";
import { useTasksStore } from "../tasks/store";
import { addBackgroundChat, removeBackgroundChat } from "./backgroundChats";

const SYNC_INTERVAL_MS = 500;
const SAVE_INTERVAL_MS = 1500;

export interface ChatHandlers extends Pick<
  ChatInit<UIMessage>,
  "onToolCall" | "onFinish" | "sendAutomaticallyWhen"
> {
  transport: ChatTransport<UIMessage>;
}

export interface ChatInstance {
  id: string;
  sessionId: string | null;
  chat: Chat<UIMessage>;
  handlers: ChatHandlers;
  /** A coding CLI answers on its own, so its turn may outlive the pane that shows it. */
  keepRunning: boolean;
  mounts: number;
  leaveBackground: (() => void) | null;
}

const instances = new Map<string, ChatInstance>();

function isBusy(chat: Chat<UIMessage>): boolean {
  return chat.status === "submitted" || chat.status === "streaming";
}

export function createChatInstance(
  id: string,
  messages: UIMessage[],
  handlers: ChatHandlers,
): ChatInstance {
  // The wrappers read the latest handlers, as a chat keeps the ones it was created with.
  const instance: ChatInstance = {
    id,
    sessionId: null,
    handlers,
    keepRunning: false,
    mounts: 0,
    leaveBackground: null,
    chat: new Chat<UIMessage>({
      id,
      messages,
      transport: {
        sendMessages: (options) => instance.handlers.transport.sendMessages(options),
        reconnectToStream: (options) => instance.handlers.transport.reconnectToStream(options),
      },
      onToolCall: (options) => instance.handlers.onToolCall?.(options),
      onFinish: (options) => instance.handlers.onFinish?.(options),
      sendAutomaticallyWhen: (options) =>
        instance.handlers.sendAutomaticallyWhen?.(options) ?? false,
    }),
  };
  return instance;
}

/** The chat that still runs or finished unseen under this id, if there is one. */
export function findChatInstance(id: string): ChatInstance | undefined {
  return instances.get(id);
}

function sessionTitle(sessionId: string): string | null {
  const sessions = useAIStore.getState().chatSessions;
  return sessions.find((session) => session.id === sessionId)?.title ?? null;
}

function runInBackground(instance: ChatInstance, sessionId: string): void {
  const { chat } = instance;
  let stopped = false;

  const sync = () => {
    if (sessionTitle(sessionId) === null) return;
    useAIStore
      .getState()
      .updateChatSessionMessages(sessionId, chat.messages.map(uiMessageToStored));
  };
  const save = () => {
    if (sessionTitle(sessionId) === null) return;
    void useAIStore
      .getState()
      .saveSessionMessages(sessionId, chat.messages.map(uiMessageToStored))
      .catch(() => {});
  };

  const unsubscribes = [
    chat["~registerMessagesCallback"](sync, SYNC_INTERVAL_MS),
    chat["~registerMessagesCallback"](save, SAVE_INTERVAL_MS),
    chat["~registerStatusCallback"](() => {
      if (isBusy(chat)) return;
      instance.leaveBackground?.();
      sync();
      save();
      const title = sessionTitle(sessionId);
      if (title === null) {
        instances.delete(instance.id);
        return;
      }
      if (stopped) return;
      const outcome = chat.status === "error" ? "error" : "done";
      if (outcome === "done") useTasksStore.getState().handleSessionDone(sessionId, null);
      reportSessionOutcome(sessionId, outcome);
      notifySessionFinished({ sessionId, title, status: outcome });
    }),
  ];
  instance.leaveBackground = () => {
    instance.leaveBackground = null;
    for (const unsubscribe of unsubscribes) unsubscribe();
    removeBackgroundChat(sessionId);
  };
  addBackgroundChat(sessionId, () => {
    stopped = true;
    void chat.stop();
  });
}

/** Keeps the chat alive while something shows it; a CLI's turn goes on after the last one left. */
export function retainChatInstance(instance: ChatInstance): () => void {
  instance.mounts += 1;
  if (!instances.has(instance.id)) instances.set(instance.id, instance);
  instance.leaveBackground?.();
  return () => {
    instance.mounts -= 1;
    if (instance.mounts > 0) return;
    if (instance.keepRunning && instance.sessionId && isBusy(instance.chat)) {
      runInBackground(instance, instance.sessionId);
      return;
    }
    if (instances.get(instance.id) === instance) instances.delete(instance.id);
    void instance.chat.stop();
  };
}

interface ChatInstanceOptions {
  id: string;
  sessionId: string | null;
  messages: UIMessage[];
  handlers: ChatHandlers;
  keepRunning: boolean;
}

/** The chat of a session, picked up again when it kept running while nothing showed it. */
export function useChatInstance({
  id,
  sessionId,
  messages,
  handlers,
  keepRunning,
}: ChatInstanceOptions): Chat<UIMessage> {
  // Messages and handlers only seed a new chat; the layout effect keeps the handlers current.
  const instance = useMemo(
    () => findChatInstance(id) ?? createChatInstance(id, messages, handlers),
    [id],
  );
  useLayoutEffect(() => {
    instance.handlers = handlers;
    instance.sessionId = sessionId;
    instance.keepRunning = keepRunning;
  });
  useEffect(() => retainChatInstance(instance), [instance]);
  return instance.chat;
}
