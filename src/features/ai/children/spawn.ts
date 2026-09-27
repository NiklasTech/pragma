import type { AgentApprovalDecision } from "@/features/agent/permissions";
import { useAgentStore, type AgentStepStatus } from "@/features/agent/store";
import { useAIStore, type ChatSession, type SessionWorktree } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { disposeTerminal, ensureTerminal } from "../terminal/runner";
import { createSessionWorktree } from "../worktree/create";
import { checkSpawnLimits, parseSpawnRequest, type SpawnRequest } from "./limits";
import { deliverTerminalPrompt } from "./terminalPrompt";

export const SPAWN_DENIED = "The user denied starting a child session";

const TERMINAL_COLS = 120;
const TERMINAL_ROWS = 32;

interface SpawnPlan {
  rootPath: string;
  parent: ChatSession;
  request: SpawnRequest;
  command: string | null;
}

type SpawnPrepare = { ok: true; plan: SpawnPlan } | { ok: false; error: string };

export interface SpawnToolOutcome {
  status: AgentStepStatus;
  detail?: string;
  result: { output: string } | { errorText: string };
}

function detectedTerminalCliIds(): string[] {
  const { cliManifests, cliStatuses } = useAIStore.getState();
  return cliManifests
    .filter((manifest) => manifest.offers_terminal && cliStatuses[manifest.id]?.installed === true)
    .map((manifest) => manifest.id);
}

function prepareChildSpawn(input: unknown): SpawnPrepare {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) return { ok: false, error: "Open a workspace to start a child session" };

  const { chatSessions, cliManifests } = useAIStore.getState();
  const parentId = useAgentStore.getState().runSessionId;
  const parent = chatSessions.find((session) => session.id === parentId);
  if (!parent) return { ok: false, error: "The parent session was not found" };
  if (parent.kind === "ask" || parent.kind === "terminal") {
    return { ok: false, error: "Only conversation sessions can start child sessions" };
  }

  const parsed = parseSpawnRequest(input, parent);
  if (!parsed.ok) return parsed;

  const limit = checkSpawnLimits(chatSessions, parent.id);
  if (limit) return { ok: false, error: limit };

  let command: string | null = null;
  if (parsed.request.kind === "terminal") {
    const detected = detectedTerminalCliIds();
    const manifest = cliManifests.find((item) => item.id === parsed.request.cli);
    if (!manifest || !detected.includes(manifest.id)) {
      return {
        ok: false,
        error: `No detected CLI has the id ${parsed.request.cli}. Detected: ${detected.join(", ") || "none"}`,
      };
    }
    command = manifest.command;
  }

  return { ok: true, plan: { rootPath, parent, request: parsed.request, command } };
}

function describeSpawn(request: SpawnRequest): string {
  const kind = request.kind === "terminal" ? `Terminal (${request.cli})` : "Conversation";
  const environment = request.environment === "worktree" ? "a new worktree" : "the checkout";
  return `${kind} in ${environment}. Prompt: ${request.prompt}`;
}

async function startChildSession(plan: SpawnPlan): Promise<ChatSession> {
  const { rootPath, parent, request, command } = plan;
  const id = crypto.randomUUID();
  // A child worktree always branches from the workspace, never from the parent's worktree.
  const worktree: SessionWorktree | undefined =
    request.environment === "worktree" ? await createSessionWorktree(rootPath, id) : undefined;
  const { createChatSession } = useAIStore.getState();

  if (request.kind === "conversation") {
    return createChatSession(
      rootPath,
      {
        id,
        title: request.title,
        kind: "agent",
        environment: request.environment,
        worktree,
        agentEngine:
          parent.agentEngine?.kind === "builtin" ? parent.agentEngine : { kind: "builtin" },
        parentId: parent.id,
        pendingPrompt: request.prompt,
      },
      { activate: false },
    );
  }

  const cwd = worktree?.status === "ready" ? worktree.path : rootPath;
  const started = ensureTerminal(id, {
    command: command ?? "",
    cwd,
    cols: TERMINAL_COLS,
    rows: TERMINAL_ROWS,
  });
  let session: ChatSession;
  try {
    session = await createChatSession(
      rootPath,
      {
        id,
        title: request.title,
        kind: "terminal",
        environment: request.environment,
        worktree,
        cliProviderId: request.cli ?? undefined,
        parentId: parent.id,
      },
      { activate: false },
    );
  } catch (err) {
    disposeTerminal(id);
    throw err;
  }
  await started;
  deliverTerminalPrompt(id, request.prompt);
  return session;
}

export async function runSpawnTool(
  toolCallId: string,
  toolName: string,
  input: unknown,
  decision: AgentApprovalDecision,
): Promise<SpawnToolOutcome> {
  const prepared = prepareChildSpawn(input);
  if (!prepared.ok) {
    return { status: "error", detail: prepared.error, result: { errorText: prepared.error } };
  }
  const { request } = prepared.plan;

  if (decision === "required") {
    const approved = await useAgentStore.getState().requestApproval({
      toolCallId,
      toolName,
      args: input,
      description: describeSpawn(request),
    });
    if (!approved) return { status: "denied", result: { errorText: SPAWN_DENIED } };
  }

  try {
    const child = await startChildSession(prepared.plan);
    const note =
      request.kind === "conversation"
        ? "The child conversation starts when the user opens it. Do not wait for it."
        : "The child terminal is running on its own. Do not wait for it.";
    return {
      status: "done",
      detail: request.title,
      result: { output: JSON.stringify({ sessionId: child.id, title: child.title, note }) },
    };
  } catch (err) {
    const errorText = `Could not start the child session: ${String(err)}`;
    return { status: "error", detail: errorText, result: { errorText } };
  }
}

export function readSpawnOutput(output: unknown): { sessionId: string; title: string } | null {
  if (typeof output !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(output);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { sessionId, title } = parsed as Record<string, unknown>;
    if (typeof sessionId !== "string" || typeof title !== "string") return null;
    return { sessionId, title };
  } catch {
    return null;
  }
}
