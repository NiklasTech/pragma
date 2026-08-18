import { useEffect, useRef } from "react";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

import { countAgentSteps } from "./loop";
import { useAgentStore } from "./store";

interface UseAgentOptions {
  chatRef: React.RefObject<UseChatHelpers<UIMessage> | null>;
  chatStatus: "submitted" | "streaming" | "ready" | "error";
}

// Owns the agent task lifecycle around the chat stream: Stop-button wiring
// and reconciling the task status when a chat run ends without the model
// calling agent_task_complete.
export function useAgent({ chatRef, chatStatus }: UseAgentOptions) {
  useEffect(() => {
    useAgentStore.getState().setStopCallback(() => chatRef.current?.stop());
    return () => {
      useAgentStore.getState().setStopCallback(null);
    };
  }, [chatRef]);

  const previousStatusRef = useRef(chatStatus);
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = chatStatus;

    const wasRunning = previous === "streaming" || previous === "submitted";
    if (!wasRunning) return;

    const store = useAgentStore.getState();
    if (store.status !== "running") return;

    if (chatStatus === "error") {
      store.failTask("The chat stream failed.");
      return;
    }

    if (chatStatus === "ready" && store.steps.length > 0) {
      const messages = chatRef.current?.messages ?? [];
      if (countAgentSteps(messages) >= store.maxSteps) {
        store.failTask(`Stopped after reaching the step limit (${store.maxSteps}).`);
      } else {
        store.setStatus("done");
      }
    }
  }, [chatStatus, chatRef]);
}
