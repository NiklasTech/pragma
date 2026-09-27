import { useCallback, useEffect, useRef, useState } from "react";

import { useAgentStore } from "@/features/agent/store";

import { decideRemove, decideStopIntent, decideSubmit } from "./queue";

export interface EnqueueResult {
  accepted: boolean;
  restore: string | null;
}

interface SteerQueueOptions {
  sessionId: string | null;
  ownsRun: boolean;
  inFlight: boolean;
  canFlush: boolean;
  submitText: (text: string) => Promise<boolean>;
  stopChat: () => void;
}

export interface SteerQueue {
  queued: string | null;
  enqueue: (raw: string) => EnqueueResult;
  remove: () => void;
  stop: () => void;
}

type ConversationStop = () => void;

let activeConversationStop: ConversationStop | null = null;

export function registerConversationStop(stop: ConversationStop | null): void {
  activeConversationStop = stop;
}

export function getConversationStop(): ConversationStop | null {
  return activeConversationStop;
}

export function useAgentStop(): () => void {
  const requestStop = useAgentStore((state) => state.requestStop);
  return useCallback(() => {
    const conversationStop = getConversationStop();
    if (conversationStop) {
      conversationStop();
      return;
    }
    requestStop();
  }, [requestStop]);
}

export function useSteerQueue({
  sessionId,
  ownsRun,
  inFlight,
  canFlush,
  submitText,
  stopChat,
}: SteerQueueOptions): SteerQueue {
  const [queued, setQueued] = useState<string | null>(null);
  const queuedRef = useRef<string | null>(null);
  const sessionRef = useRef(sessionId);
  const inFlightRef = useRef(inFlight);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (sessionRef.current === sessionId) return;
    sessionRef.current = sessionId;
    queuedRef.current = null;
    setQueued(null);
  }, [sessionId]);

  const enqueue = useCallback((raw: string): EnqueueResult => {
    const decision = decideSubmit(queuedRef.current, raw);
    if (decision.action === "ignore") return { accepted: false, restore: null };
    queuedRef.current = decision.queued;
    setQueued(decision.queued);
    return { accepted: true, restore: decision.restore };
  }, []);

  const remove = useCallback(() => {
    queuedRef.current = decideRemove().queued;
    setQueued(null);
  }, []);

  const stop = useCallback(() => {
    if (!ownsRun) {
      stopChat();
      return;
    }
    useAgentStore.getState().requestStop(decideStopIntent(queuedRef.current));
  }, [ownsRun, stopChat]);

  useEffect(() => {
    const wasInFlight = inFlightRef.current;
    inFlightRef.current = inFlight;
    if (!wasInFlight || inFlight) return;

    const text = queuedRef.current;
    if (text === null || !canFlush) return;

    const token = sessionRef.current;
    queuedRef.current = null;
    setQueued(null);

    void submitText(text).then((sent) => {
      if (sent || !mountedRef.current || sessionRef.current !== token) return;
      queuedRef.current = text;
      setQueued(text);
    });
  }, [inFlight, canFlush, submitText]);

  useEffect(() => {
    if (!ownsRun) return;
    registerConversationStop(stop);
    return () => {
      registerConversationStop(null);
    };
  }, [ownsRun, stop]);

  return { queued, enqueue, remove, stop };
}
