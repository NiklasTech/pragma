import type { AgentApprovalDecision } from "@/features/agent/permissions";
import type { AgentRunContext } from "@/features/agent/runContext";
import type { AgentStepStatus } from "@/features/agent/store";
import {
  useAIStore,
  type AgentEngine,
  type ChatSession,
  type WorkEnvironment,
} from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";

import { terminalLaunchCommand } from "../terminal/cliAttention";
import { disposeTerminal, ensureTerminal } from "../terminal/runner";
import { createWorktreeEnvironment } from "../worktree/create";
import { sessionEnvironment } from "../worktree/cwd";
import {
  checkSpawnLimits,
  parseSpawnRequest,
  spawnLimits,
  type ChildEnvironmentSetting,
  type SpawnRequest,
} from "./limits";
import { startChildRun } from "./runner";
import { deliverTerminalPrompt } from "./terminalPrompt";

export const SPAWN_DENIED = "The user denied starting a child session";

const TERMINAL_COLS = 120;
const TERMINAL_ROWS = 32;

interface SpawnPlan {
  rootPath: string;
  parent: ChatSession;
  /** The parent's worktree, which a `worktree` child branches from. */
  parentWorktree: WorkEnvironment | undefined;
  engine: AgentEngine;
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

function childEnvironmentSetting(rootPath: string): ChildEnvironmentSetting | undefined {
  const workspace = useWorkspaceSettingsStore.getState();
  return workspace.rootPath === rootPath ? workspace.settings?.agent?.childEnvironment : undefined;
}

function prepareChildSpawn(input: unknown, context: AgentRunContext): SpawnPrepare {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) return { ok: false, error: "Open a workspace to start a child session" };

  const { chatSessions, cliManifests, workEnvironments } = useAIStore.getState();
  const parentId = context.sessionId();
  const parent = chatSessions.find((session) => session.id === parentId);
  if (!parent) return { ok: false, error: "The parent session was not found" };
  if (parent.kind === "ask" || parent.kind === "terminal") {
    return { ok: false, error: "Only conversation sessions can start child sessions" };
  }

  const parsed = parseSpawnRequest(input, parent, childEnvironmentSetting(rootPath));
  if (!parsed.ok) return parsed;

  const limit = checkSpawnLimits(
    chatSessions,
    parent.id,
    spawnLimits(useSettingsStore.getState().agent),
  );
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
    command = terminalLaunchCommand(manifest.id, manifest.command);
  }

  // A child runs on the parent's engine; a builtin parent's child is always a builtin agent.
  const engine: AgentEngine =
    context.childEngine() ??
    (parent.agentEngine?.kind === "builtin" ? parent.agentEngine : { kind: "builtin" });

  const environment = sessionEnvironment(parent, workEnvironments);
  const parentWorktree = environment?.kind === "worktree" ? environment : undefined;
  return {
    ok: true,
    plan: { rootPath, parent, parentWorktree, engine, request: parsed.request, command },
  };
}

function describeSpawn({ request, parentWorktree }: SpawnPlan): string {
  const kind = request.kind === "terminal" ? `Terminal (${request.cli})` : "Conversation";
  const environments = {
    checkout: "the checkout",
    worktree: parentWorktree ? `a new worktree from ${parentWorktree.branch}` : "a new worktree",
    parent: parentWorktree ? `the parent's worktree ${parentWorktree.branch}` : "the checkout",
  };
  return `${kind} in ${environments[request.environment]}. Prompt: ${request.prompt}`;
}

/** The child's environment: its own worktree (from the parent's branch), the parent's, or the checkout. */
async function childEnvironment(
  plan: SpawnPlan,
): Promise<{ environment: "checkout" | "worktree"; worktree?: WorkEnvironment }> {
  const { rootPath, parentWorktree, request } = plan;
  if (request.environment === "parent") {
    return parentWorktree
      ? { environment: "worktree", worktree: parentWorktree }
      : { environment: "checkout" };
  }
  if (request.environment === "checkout") return { environment: "checkout" };
  const worktree = await createWorktreeEnvironment(rootPath, parentWorktree?.branch);
  return { environment: "worktree", worktree };
}

async function startChildSession(plan: SpawnPlan): Promise<ChatSession> {
  const { rootPath, parent, engine, request, command } = plan;
  const id = crypto.randomUUID();
  const { environment, worktree } = await childEnvironment(plan);
  const { createChatSession } = useAIStore.getState();

  if (request.kind === "conversation") {
    const session = await createChatSession(
      rootPath,
      {
        id,
        title: request.title,
        kind: "agent",
        environment,
        environmentId: worktree?.id,
        agentEngine: engine,
        parentId: parent.id,
      },
      { activate: false },
    );
    await startChildRun(rootPath, session.id, request.prompt);
    return session;
  }

  const cwd = worktree?.setupStatus === "ready" ? worktree.path : rootPath;
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
        environment,
        environmentId: worktree?.id,
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
  context: AgentRunContext,
): Promise<SpawnToolOutcome> {
  const prepared = prepareChildSpawn(input, context);
  if (!prepared.ok) {
    return { status: "error", detail: prepared.error, result: { errorText: prepared.error } };
  }
  const { request } = prepared.plan;

  if (decision === "required") {
    const approved = await context.requestApproval({
      toolCallId,
      toolName,
      args: input,
      description: describeSpawn(prepared.plan),
    });
    if (!approved) return { status: "denied", result: { errorText: SPAWN_DENIED } };
  }

  try {
    const child = await startChildSession(prepared.plan);
    const note = `The child ${request.kind} is running on its own. Do not wait for it.`;
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
