import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";

import { useAgentStore, type AgentStatus } from "@/features/agent/store";

import { reportSessionOutcome } from "../notifications/outcomes";
import { useTasksStore } from "./store";

export type SessionRunOutcome = "done" | "error" | "cancelled" | "idle";

type SubmitText = (text: string) => Promise<boolean>;

interface SessionRunsState {
  liveSessionId: string | null;
  connectedSessionId: string | null;
}

export const useSessionRunsStore = create<SessionRunsState>()(() => ({
  liveSessionId: null,
  connectedSessionId: null,
}));

let liveStop: (() => void) | null = null;
let connectedSubmit: SubmitText | null = null;

function setLive(sessionId: string, stop: () => void): void {
  liveStop = stop;
  if (useSessionRunsStore.getState().liveSessionId !== sessionId) {
    useSessionRunsStore.setState({ liveSessionId: sessionId });
  }
}

function clearLive(sessionId: string | null): void {
  if (!sessionId || useSessionRunsStore.getState().liveSessionId !== sessionId) return;
  liveStop = null;
  useSessionRunsStore.setState({ liveSessionId: null });
}

export function stopLiveSession(sessionId: string): boolean {
  if (useSessionRunsStore.getState().liveSessionId !== sessionId || !liveStop) return false;
  liveStop();
  return true;
}

/// Sends through the chat once it shows the session; the caller focuses the session first.
export function sendToSession(sessionId: string, text: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    const settle = (sent: Promise<boolean> | boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      void Promise.resolve(sent)
        .catch(() => false)
        .then(resolve);
    };
    const attempt = () => {
      const submit = connectedSubmit;
      if (useSessionRunsStore.getState().connectedSessionId === sessionId && submit) {
        settle(submit(text));
      }
    };
    timer = setTimeout(() => settle(false), timeoutMs);
    unsubscribe = useSessionRunsStore.subscribe(attempt);
    attempt();
  });
}

export function resolveRunOutcome(input: {
  usesAgentRun: boolean;
  agentStatus: AgentStatus;
  chatFailed: boolean;
  stopRequested: boolean;
}): SessionRunOutcome {
  if (input.usesAgentRun) {
    switch (input.agentStatus) {
      case "done":
      case "error":
      case "cancelled":
        return input.agentStatus;
      default:
        return "idle";
    }
  }
  if (input.stopRequested) return "cancelled";
  return input.chatFailed ? "error" : "done";
}

interface SessionRunReporterOptions {
  sessionId: string | null;
  inFlight: boolean;
  chatFailed: boolean;
  isCLIActive: boolean;
  stop: () => void;
  submitText: SubmitText;
}

/// Connects the mounted chat to task actions and reports how each of its runs ended.
export function useSessionRunReporter({
  sessionId,
  inFlight,
  chatFailed,
  isCLIActive,
  stop,
  submitText,
}: SessionRunReporterOptions): () => void {
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const submitRef = useRef(submitText);
  submitRef.current = submitText;
  const stopRequestedRef = useRef(false);
  const previousRef = useRef<{ sessionId: string | null; inFlight: boolean }>({
    sessionId,
    inFlight: false,
  });

  const reportedStop = useCallback(() => {
    stopRequestedRef.current = true;
    stopRef.current();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    connectedSubmit = (text) => submitRef.current(text);
    useSessionRunsStore.setState({ connectedSessionId: sessionId });
    return () => {
      if (useSessionRunsStore.getState().connectedSessionId !== sessionId) return;
      connectedSubmit = null;
      useSessionRunsStore.setState({ connectedSessionId: null });
    };
  }, [sessionId]);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { sessionId, inFlight };

    if (inFlight && sessionId) {
      if (!previous.inFlight || previous.sessionId !== sessionId) stopRequestedRef.current = false;
      setLive(sessionId, reportedStop);
      return;
    }
    if (!previous.inFlight) return;

    clearLive(previous.sessionId);
    if (!sessionId || previous.sessionId !== sessionId) return;

    const agent = useAgentStore.getState();
    const usesAgentRun = agent.modeActive && !isCLIActive;
    const outcome = resolveRunOutcome({
      usesAgentRun,
      agentStatus: agent.status,
      chatFailed,
      stopRequested: stopRequestedRef.current,
    });
    if (outcome === "done") {
      useTasksStore.getState().handleSessionDone(sessionId, usesAgentRun ? agent.summary : null);
    }
    if (outcome === "done" || outcome === "error") reportSessionOutcome(sessionId, outcome);
  }, [sessionId, inFlight, chatFailed, isCLIActive, reportedStop]);

  useEffect(
    () => () => {
      clearLive(previousRef.current.sessionId);
    },
    [],
  );

  return reportedStop;
}
