import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

const PERMISSION_EVENT = "acp_request_permission";

export type ApprovalDecision = "allow" | "allow_always" | "deny";

/** A permission request a coding CLI sent over ACP. */
export interface AcpApproval {
  chatSessionId: string;
  toolCallId: string;
  toolName: string;
  args?: unknown;
  description?: string;
  /** The agent's name for "always allow"; absent when it offers no such option. */
  alwaysLabel?: string;
}

interface AcpApprovalsState {
  bySession: Record<string, AcpApproval[]>;
}

export const useAcpApprovalsStore = create<AcpApprovalsState>()(() => ({ bySession: {} }));

export function addAcpApproval(approval: AcpApproval): void {
  useAcpApprovalsStore.setState((state) => ({
    bySession: {
      ...state.bySession,
      [approval.chatSessionId]: [...(state.bySession[approval.chatSessionId] ?? []), approval],
    },
  }));
}

function removeAcpApproval(chatSessionId: string, toolCallId: string): boolean {
  const approvals = useAcpApprovalsStore.getState().bySession[chatSessionId] ?? [];
  if (!approvals.some((item) => item.toolCallId === toolCallId)) return false;
  useAcpApprovalsStore.setState((state) => ({
    bySession: {
      ...state.bySession,
      [chatSessionId]: approvals.filter((item) => item.toolCallId !== toolCallId),
    },
  }));
  return true;
}

export async function resolveAcpApproval(
  chatSessionId: string,
  toolCallId: string,
  decision: ApprovalDecision,
): Promise<void> {
  if (!removeAcpApproval(chatSessionId, toolCallId)) return;
  // The CLI gives up after a timeout; answering a request it dropped is harmless.
  await invoke("cli_acp_approve", { req: { tool_call_id: toolCallId, decision } }).catch(() => {});
}

/** Collects permission requests from coding CLIs, or allows them at once in yolo mode. */
export function useAcpApprovalRequests(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      try {
        unlisten = await listen<AcpApproval>(PERMISSION_EVENT, (event) => {
          const approval = event.payload;
          // Every window hears the event; only the one that holds the session shows it.
          const known = useAIStore
            .getState()
            .chatSessions.some((session) => session.id === approval.chatSessionId);
          if (!known) return;
          addAcpApproval(approval);
          if (useSettingsStore.getState().ai.yoloMode) {
            void resolveAcpApproval(approval.chatSessionId, approval.toolCallId, "allow");
          }
        });
      } catch {
        // Tauri is unavailable outside the desktop runtime.
      }
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
}
