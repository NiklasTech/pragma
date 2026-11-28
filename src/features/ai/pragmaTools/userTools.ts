import { toast } from "sonner";

import { readStringInput } from "@/features/agent/toolInput";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { useSpawnApprovalsStore } from "../children/acpSpawn";
import { playAttentionTone } from "../notifications/attentionCards";
import { focusAttentionSession } from "../notifications/focusSession";
import { showSystemNotification } from "../notifications/notifier";
import type { PragmaToolContext, PragmaToolHandler } from "./types";

const MAX_OPTIONS = 9;
const MAX_TEXT = 300;
// The MCP server gives up after 15 minutes; the question goes a little earlier.
const QUESTION_TIMEOUT_MS = 14 * 60 * 1000;

function text(args: unknown, key: string): string {
  const value = readStringInput(args, key).trim();
  if (!value) throw new Error(`${key} is required`);
  return value.slice(0, MAX_TEXT);
}

function options(args: unknown): string[] {
  const value =
    typeof args === "object" && args !== null ? (args as Record<string, unknown>).options : null;
  const list = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
  if (list.length < 2 || list.length > MAX_OPTIONS) {
    throw new Error(`options needs 2 to ${MAX_OPTIONS} answers`);
  }
  return list.map((item) => item.trim().slice(0, MAX_TEXT));
}

function sessionTitle(sessionId: string): string {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  return session?.title || "An agent";
}

function removeQuestion(sessionId: string, toolCallId: string): void {
  useSpawnApprovalsStore.setState((state) => ({
    bySession: {
      ...state.bySession,
      [sessionId]: (state.bySession[sessionId] ?? []).filter(
        (item) => item.toolCallId !== toolCallId,
      ),
    },
  }));
}

async function askUser(args: unknown, context: PragmaToolContext): Promise<string> {
  const question = text(args, "question");
  const answers = options(args);
  const choice = await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => {
      removeQuestion(context.sessionId, context.requestId);
      resolve(null);
    }, QUESTION_TIMEOUT_MS);
    const settle = (value: string | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    useSpawnApprovalsStore.setState((state) => ({
      bySession: {
        ...state.bySession,
        [context.sessionId]: [
          ...(state.bySession[context.sessionId] ?? []),
          {
            toolCallId: context.requestId,
            toolName: "ask_user",
            args,
            description: question,
            options: answers,
            choose: (option) => settle(option),
            resolve: () => settle(null),
          },
        ],
      },
    }));
  });
  return choice === null
    ? "The user dismissed the question without an answer."
    : `The user chose: ${choice}`;
}

async function notifyUser(args: unknown, context: PragmaToolContext): Promise<string> {
  const message = text(args, "message");
  const title = sessionTitle(context.sessionId);
  const settings = useSettingsStore.getState().notifications;
  if (document.hasFocus()) {
    if (!settings.card) return "Notifications are turned off in Pragma's settings.";
    toast(title, {
      description: message,
      action: { label: "Open", onClick: () => focusAttentionSession(context.sessionId) },
    });
    if (settings.sound) playAttentionTone();
  } else {
    if (!settings.system) return "System notifications are turned off in Pragma's settings.";
    await showSystemNotification(title, message, settings.sound);
  }
  return "The user was notified.";
}

export const USER_TOOLS: Record<string, PragmaToolHandler> = {
  ask_user: askUser,
  notify_user: notifyUser,
};
