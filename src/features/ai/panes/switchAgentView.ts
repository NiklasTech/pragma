import { invoke } from "@tauri-apps/api/core";

import { generateId } from "@/shared/lib/ai/id";
import {
  useAIStore,
  type ChatMessage,
  type ChatSession,
  type CLIManifest,
} from "@/shared/stores/ai";

import { sessionMcpServerIds } from "@/features/ai/mcp/selection";

import { useAcpSessionInfoStore } from "../acp/sessionInfo";
import { useAcpSessionOptionsStore } from "../acp/sessionOptions";
import { selectAgentState, useAgentStatesStore } from "../state/agentStates";
import { resumableCliSession } from "../terminal/resume";
import { disposeTerminal, getTerminalCliSessionId } from "../terminal/runner";
import { isShellSession } from "../terminal/shell";
import { sessionCwd } from "../worktree/cwd";
import { cliConversationInit } from "./launch";

interface ReplayedMessage {
  role: "user" | "assistant";
  content: string;
}

type SwitchableSession = Pick<
  ChatSession,
  "id" | "kind" | "cliProviderId" | "cliSessionId" | "cliAccountDir"
>;

function manifestOf(session: SwitchableSession): CLIManifest | undefined {
  return useAIStore.getState().cliManifests.find((item) => item.id === session.cliProviderId);
}

/** The conversation of a CLI terminal, as the running CLI reported it or as stored. */
function terminalConversation(session: SwitchableSession): string | null {
  return getTerminalCliSessionId(session.id) ?? session.cliSessionId ?? null;
}

/** Whether the CLI in this terminal can go on with its conversation in Pragma chat. */
export function canShowAsChat(
  session: SwitchableSession,
  manifest: CLIManifest | undefined,
): boolean {
  return (
    session.kind === "terminal" &&
    !isShellSession(session) &&
    manifest?.uses_acp === true &&
    terminalConversation(session) !== null
  );
}

/** Whether this chat's conversation can go on in the CLI's own terminal. */
export function canShowInTerminal(
  session: SwitchableSession,
  manifest: CLIManifest | undefined,
): boolean {
  return (
    session.kind !== "terminal" &&
    manifest?.offers_terminal === true &&
    resumableCliSession({ ...session, kind: "terminal" }) !== null
  );
}

function assertIdle(session: SwitchableSession, name: string): void {
  if (selectAgentState(session.id)(useAgentStatesStore.getState()) === "working") {
    throw new Error(`${name} is still working. Switch the view when it is done.`);
  }
}

/** The ACP state of the chat's last agent; the next view starts or loads its own. */
function forgetAcpSession(sessionId: string): void {
  useAcpSessionOptionsStore.getState().forget(sessionId);
  useAcpSessionInfoStore.getState().forget(sessionId);
}

function currentSession(sessionId: string): ChatSession {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("The session is gone");
  return session;
}

/**
 * Moves a CLI's conversation from its terminal into Pragma chat in the same pane: the agent
 * loads it over ACP, the chat shows its messages, then the terminal ends.
 */
export async function showAsChat(sessionId: string): Promise<void> {
  const session = currentSession(sessionId);
  const manifest = manifestOf(session);
  const conversation = terminalConversation(session);
  if (!manifest || !conversation || !canShowAsChat(session, manifest)) {
    throw new Error("This terminal cannot be shown as Pragma chat");
  }
  assertIdle(session, manifest.name);

  const { workEnvironments } = useAIStore.getState();
  const replayed = await invoke<ReplayedMessage[]>("cli_acp_open_session", {
    req: {
      provider_id: manifest.id,
      chat_session_id: session.id,
      cwd: sessionCwd(session, workEnvironments, session.rootPath),
      allow_child_sessions: true,
      mcp_server_ids: sessionMcpServerIds(session.id) ?? undefined,
      account_dir: session.cliAccountDir ?? undefined,
      resume_session_id: conversation,
    },
  });

  const now = Date.now();
  const messages: ChatMessage[] = replayed.map((message) => ({
    id: generateId(),
    role: message.role,
    content: message.content,
    timestamp: now,
  }));
  const { updateChatSessionMessages, saveSessionMessages, updateChatSession } =
    useAIStore.getState();
  updateChatSessionMessages(session.id, messages);
  await saveSessionMessages(session.id, messages);
  forgetAcpSession(session.id);
  await updateChatSession({
    ...currentSession(session.id),
    ...cliConversationInit(manifest, session.cliAccountDir),
    cliSessionId: conversation,
    updatedAt: Date.now(),
  });
  // The pane shows the chat now; the CLI in the old terminal must not write to the conversation.
  disposeTerminal(session.id);
}

/**
 * Moves a chat's conversation into the CLI's own terminal in the same pane: the chat's agent
 * ends, then the terminal resumes the conversation.
 */
export async function showInTerminal(sessionId: string): Promise<void> {
  const session = currentSession(sessionId);
  const manifest = manifestOf(session);
  if (!manifest || !canShowInTerminal(session, manifest)) {
    throw new Error("This chat cannot be shown in a terminal");
  }
  assertIdle(session, manifest.name);

  await invoke("cli_acp_stop_session", { req: { chat_session_id: session.id } });
  forgetAcpSession(session.id);
  // A terminal of this session from before would start over instead of resuming.
  disposeTerminal(session.id);
  await useAIStore
    .getState()
    .updateChatSession({ ...currentSession(session.id), kind: "terminal", updatedAt: Date.now() });
}
