import { AbstractChat, type ChatState, type ChatStatus, type UIMessage } from "ai";

import { executeAgentTool } from "@/features/agent/executor";
import {
  countAgentSteps,
  lastStepHasToolCalls,
  lastStepToolCallsAnswered,
  shouldAgentContinue,
} from "@/features/agent/loop";
import { loadProjectRules } from "@/features/agent/rules";
import type { AgentRunContext } from "@/features/agent/runContext";
import { OPEN_BROWSER_TOOL_DEFINITION } from "@/features/agent/browserTool";
import { SPAWN_SESSION_TOOL_DEFINITION } from "@/features/agent/spawnTool";
import { writeAgentFileEdit } from "@/features/agent/applyEdit";
import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  buildAgentSystemPrompt,
  isAgentTool,
} from "@/features/agent/tools";
import { composeAgentSystemPrompt } from "@/features/ai/named-agents/prompt";
import { formatSkillCatalog, selectCatalogSkills } from "@/features/ai/skills/catalog";
import { useSkillsStore } from "@/features/ai/skills/store";
import { isAcpActive } from "@/shared/lib/ai/acp";
import { callMcpTool, loadMcpChatTools, mcpToolDefinition } from "@/shared/lib/ai/mcpTools";
import { uiMessageToStored } from "@/shared/lib/ai/protocol";
import { resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import { createStreamTransport } from "@/shared/lib/ai/transport";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { sessionCwd } from "../worktree/cwd";
import {
  getChildRun,
  isRunLive,
  mergeChildTodos,
  patchChildRun,
  requestChildApproval,
  setChildRun,
  type ChildRunStatus,
} from "./runStore";

const PUBLISH_INTERVAL_MS = 50;
const PERSIST_INTERVAL_MS = 1000;

class ChildChatState implements ChatState<UIMessage> {
  messages: UIMessage[] = [];
  error: Error | undefined = undefined;
  #status: ChatStatus = "ready";

  constructor(
    private readonly onMessages: () => void,
    private readonly onStatus: (status: ChatStatus) => void,
  ) {}

  get status(): ChatStatus {
    return this.#status;
  }

  set status(status: ChatStatus) {
    this.#status = status;
    this.onStatus(status);
  }

  pushMessage = (message: UIMessage) => {
    this.messages = [...this.messages, message];
    this.onMessages();
  };

  popMessage = () => {
    this.messages = this.messages.slice(0, -1);
    this.onMessages();
  };

  replaceMessage = (index: number, message: UIMessage) => {
    this.messages = [...this.messages.slice(0, index), message, ...this.messages.slice(index + 1)];
    this.onMessages();
  };

  snapshot = <T>(thing: T): T => structuredClone(thing);
}

class ChildChat extends AbstractChat<UIMessage> {}

interface LiveRun {
  chat: ChildChat;
  state: ChildChatState;
}

const liveRuns = new Map<string, LiveRun>();

function settle(rootPath: string, sessionId: string, status: ChildRunStatus, error?: string) {
  const live = liveRuns.get(sessionId);
  const run = getChildRun(sessionId);
  if (run) {
    for (const approval of run.approvals) approval.resolve(false);
    patchChildRun(sessionId, {
      status,
      approvals: [],
      ...(error ? { error } : {}),
      ...(live ? { messages: live.state.messages } : {}),
    });
  }
  if (!live) return;
  liveRuns.delete(sessionId);
  persist(rootPath, sessionId, live.state.messages);
}

function persist(rootPath: string, sessionId: string, messages: UIMessage[]): void {
  const stored = messages.map(uiMessageToStored);
  const ai = useAIStore.getState();
  if (!ai.chatSessions.some((session) => session.id === sessionId)) return;
  ai.updateChatSessionMessages(sessionId, stored);
  void ai.saveSessionMessages(rootPath, sessionId, stored).catch(() => {});
}

function createContext(sessionId: string): AgentRunContext {
  const checkpoints = new Set<string>();
  return {
    sessionId: () => sessionId,
    childEngine: () => null,
    isCancelled: () => getChildRun(sessionId)?.status === "cancelled",
    addStep: () => {},
    updateStep: () => {},
    requestApproval: (approval) => requestChildApproval(sessionId, approval),
    setTodos: (items) => mergeChildTodos(sessionId, items),
    finishTask: (summary) => patchChildRun(sessionId, { status: "done", summary }),
    applyFileEdit: async (edit, decision) => {
      if (decision === "required") {
        const approved = await requestChildApproval(sessionId, {
          toolCallId: edit.toolCallId,
          toolName: AGENT_TOOL_NAMES.writeFile,
          args: { path: edit.path },
        });
        if (!approved) throw new Error("The user rejected this edit.");
      }
      await writeAgentFileEdit(edit, {
        has: (path) => checkpoints.has(path),
        add: (path) => void checkpoints.add(path),
      });
    },
  };
}

/// Runs a child conversation's first turn without a pane, reporting to its own run state.
export async function startChildRun(
  rootPath: string,
  sessionId: string,
  prompt: string,
): Promise<void> {
  const ai = useAIStore.getState();
  const session = ai.chatSessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("The child session was not found");

  const settings = useSettingsStore.getState();
  const engine = resolveEffectiveEngine(session.agentEngine ?? null, ai);
  const isCLI = engine.cliProviderId !== null;
  const acp = isAcpActive(ai.cliManifests, engine.cliProviderId, settings.experimental.acp);
  const cwd = sessionCwd(session, rootPath);

  setChildRun(sessionId, {
    status: "running",
    messages: [],
    approvals: [],
    todos: [],
    summary: null,
    error: null,
  });

  const mcpTools = isCLI ? [] : await loadMcpChatTools().catch(() => []);
  let systemPrompt: string | undefined;
  if (!isCLI) {
    const rules = settings.agent.useProjectRules ? await loadProjectRules(cwd) : null;
    const skills = selectCatalogSkills(useSkillsStore.getState().skills, null);
    systemPrompt = composeAgentSystemPrompt(
      buildAgentSystemPrompt(cwd, rules, null),
      formatSkillCatalog(skills),
    );
  }
  // The user may have stopped the child while its tools and rules were loading.
  if (!isRunLive(getChildRun(sessionId))) return;

  const tools = isCLI
    ? []
    : [
        ...mcpTools.map(mcpToolDefinition),
        ...AGENT_TOOL_DEFINITIONS,
        SPAWN_SESSION_TOOL_DEFINITION,
        OPEN_BROWSER_TOOL_DEFINITION,
      ];

  const transport = createStreamTransport(
    engine.provider,
    engine.model,
    engine.baseUrl,
    isCLI,
    engine.cliProviderId,
    tools,
    cwd,
    sessionId,
    acp,
    systemPrompt,
    null,
    () => null,
    true,
  );

  const context = createContext(sessionId);
  const stepLimit = settings.agent.stepLimit;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  let previousStatus: ChatStatus = "ready";

  // Ends the run once the chat is idle and nothing will continue it.
  const settleIfIdle = () => {
    if (!liveRuns.has(sessionId)) return;
    if (state.status !== "ready" && state.status !== "error") return;
    const run = getChildRun(sessionId);
    if (!run || !isRunLive(run)) {
      settle(rootPath, sessionId, run?.status ?? "done");
    } else if (isCLI) {
      settle(rootPath, sessionId, "done");
    } else if (stepLimit !== null && countAgentSteps(state.messages) >= stepLimit) {
      settle(rootPath, sessionId, "error", `Stopped after reaching the step limit (${stepLimit}).`);
    } else if (
      !lastStepHasToolCalls(state.messages) ||
      (lastStepToolCallsAnswered(state.messages) && !shouldAgentContinue(state.messages, stepLimit))
    ) {
      settle(rootPath, sessionId, "done");
    }
  };

  const state = new ChildChatState(
    () => {
      publishTimer ??= setTimeout(() => {
        publishTimer = undefined;
        if (liveRuns.has(sessionId)) patchChildRun(sessionId, { messages: state.messages });
      }, PUBLISH_INTERVAL_MS);
      persistTimer ??= setTimeout(() => {
        persistTimer = undefined;
        if (liveRuns.has(sessionId)) persist(rootPath, sessionId, state.messages);
      }, PERSIST_INTERVAL_MS);
    },
    (status) => {
      const wasRunning = previousStatus === "streaming" || previousStatus === "submitted";
      previousStatus = status;
      if (!wasRunning) return;

      // The chat sets its error right after the status, so read it once that has happened.
      queueMicrotask(() => {
        if (status === "error" && isRunLive(getChildRun(sessionId))) {
          settle(rootPath, sessionId, "error", state.error?.message ?? "The chat stream failed.");
          return;
        }
        if (status === "ready" || status === "error") settleIfIdle();
      });
    },
  );

  const chat: ChildChat = new ChildChat({
    id: `child:${sessionId}`,
    transport,
    state,
    sendAutomaticallyWhen: ({ messages }) => {
      if (isCLI || !isRunLive(getChildRun(sessionId))) return false;
      return shouldAgentContinue(messages, stepLimit);
    },
    onToolCall: async ({ toolCall }) => {
      if (acp) return;
      const call = {
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: toolCall.input,
      };
      const tool = mcpTools.find((item) => item.displayName === toolCall.toolName);
      const result = isAgentTool(toolCall.toolName)
        ? await executeAgentTool(call, cwd, null, context)
        : tool
          ? await callMcpTool(tool, toolCall.input)
          : { errorText: `Tool ${toolCall.toolName} is not available` };
      // Awaiting the output here would deadlock: the chat queues it behind the running request.
      const added =
        "errorText" in result
          ? chat.addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              state: "output-error",
              errorText: result.errorText,
            })
          : chat.addToolOutput({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output: result.output,
            });
      void Promise.resolve(added).then(() => setTimeout(settleIfIdle, 0));
    },
  });

  liveRuns.set(sessionId, { chat, state });
  void chat.sendMessage({ text: prompt });
}

export function stopChildRun(rootPath: string, sessionId: string): void {
  const live = liveRuns.get(sessionId);
  if (!isRunLive(getChildRun(sessionId))) return;
  patchChildRun(sessionId, { status: "cancelled" });
  void live?.chat.stop();
  settle(rootPath, sessionId, "cancelled");
}
