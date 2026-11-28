import { Terminal } from "@xterm/xterm";

import { readNumberInput, readStringInput } from "@/features/agent/toolInput";
import { AGENT_STATE_LABELS } from "@/shared/components/ui/status-dot";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { getAgentSettings } from "@/shared/stores/workspaceSettings/effective";
import { deliverToSession } from "@/shell/chrome/commandLine/delivery";

import { requestSpawnApproval } from "../children/acpSpawn";
import { sessionAgentManifest } from "../sessions/sessionAgent";
import { useAgentStatesStore } from "../state/agentStates";
import { getTerminalBuffer, getTerminalSize } from "../terminal/runner";
import type { PragmaToolContext, PragmaToolHandler } from "./types";

const DEFAULT_LINES = 80;
const MAX_LINES = 300;
const MAX_MESSAGE_CHARS = 4000;

function projectSessions(rootPath: string): ChatSession[] {
  return useAIStore
    .getState()
    .chatSessions.filter((session) => session.rootPath === rootPath && !session.archived);
}

function agentName(sessionId: string): string {
  const state = useAIStore.getState();
  return sessionAgentManifest(state, sessionId)?.name ?? "Pragma";
}

/** Another session of the same project; agents do not reach into other projects. */
function otherSession(args: unknown, context: PragmaToolContext): ChatSession {
  const id = readStringInput(args, "session").trim();
  if (!id) throw new Error("session is required");
  if (id === context.sessionId) throw new Error("That is your own session.");
  const session = projectSessions(context.rootPath).find((item) => item.id === id);
  if (!session) throw new Error(`No session ${id} in this project; list them with sessions_list.`);
  return session;
}

async function listSessions(_args: unknown, context: PragmaToolContext): Promise<string> {
  const states = useAgentStatesStore.getState().entries;
  const rows = projectSessions(context.rootPath).map((session) => {
    const state = AGENT_STATE_LABELS[states[session.id]?.state ?? "idle"].toLowerCase();
    const kind = session.kind === "terminal" ? "terminal" : "chat";
    const own = session.id === context.sessionId ? " (you)" : "";
    return `${session.id}  ${session.title || "Untitled"}  ${agentName(session.id)}, ${kind}, ${state}${own}`;
  });
  return rows.length > 0 ? rows.join("\n") : "No sessions in this project.";
}

/// Renders a terminal's output off screen at the PTY's size, so cursor moves land where they did.
function terminalScreen(sessionId: string): Promise<string[]> {
  const size = getTerminalSize(sessionId);
  const term = new Terminal({
    cols: size?.cols ?? 120,
    rows: size?.rows ?? 40,
    scrollback: MAX_LINES,
    allowProposedApi: true,
  });
  return new Promise((resolve) => {
    term.write(getTerminalBuffer(sessionId), () => {
      const buffer = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buffer.length; i++) {
        lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
      }
      term.dispose();
      while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
      resolve(lines);
    });
  });
}

async function readSession(args: unknown, context: PragmaToolContext): Promise<string> {
  const session = otherSession(args, context);
  const count = Math.min(Math.max(1, readNumberInput(args, "lines") ?? DEFAULT_LINES), MAX_LINES);
  if (session.kind === "terminal") {
    const lines = (await terminalScreen(session.id)).slice(-count);
    return lines.length > 0 ? lines.join("\n") : "The terminal has no output yet.";
  }
  const messages = session.messages.slice(-count);
  if (messages.length === 0) return "The chat has no messages yet.";
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
}

/// Messaging another agent acts in its session, so it asks like starting a child session does.
function sendNeedsApproval(rootPath: string): boolean {
  if (useSettingsStore.getState().ai.yoloMode) return false;
  return getAgentSettings(rootPath).autoApprove !== "all";
}

async function sendToSession(args: unknown, context: PragmaToolContext): Promise<string> {
  const session = otherSession(args, context);
  const message = readStringInput(args, "message").trim();
  if (!message) throw new Error("message is required");
  if (message.length > MAX_MESSAGE_CHARS) {
    throw new Error(`message must be ${MAX_MESSAGE_CHARS} characters or fewer`);
  }
  if (sendNeedsApproval(context.rootPath)) {
    const allowed = await requestSpawnApproval(context.sessionId, {
      toolCallId: context.requestId,
      toolName: "session_send",
      args: { ...(args as object), title: session.title },
      description: message,
    });
    if (!allowed) return "The user did not allow the message. Nothing was sent.";
  }
  deliverToSession(session, message);
  return session.kind === "terminal"
    ? `Typed the message into ${session.title || session.id}.`
    : `Handed the message to the chat ${session.title || session.id}; it is sent when the chat is shown.`;
}

export const SESSION_TOOLS: Record<string, PragmaToolHandler> = {
  sessions_list: listSessions,
  session_read: readSession,
  session_send: sendToSession,
};
