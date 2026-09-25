import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useChat, type UIMessage, type UseChatHelpers } from "@ai-sdk/react";
import { type ChatTransport } from "ai";
import { invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  shouldPersistSession,
  type SessionPersistSnapshot,
} from "@/shared/stores/sessionPersistence";
import {
  parseMentions,
  stripMentions,
  type AutoContextAttachment,
  type ChatContextResult,
} from "@/shared/lib/chat-context";
import { collectLiveAutoContext } from "@/features/ai/context/liveContext";
import { buildAutoContextPrompt } from "@/features/ai/context/autoContext";
import {
  setPendingFirstMessage,
  takePendingFirstMessage,
} from "@/features/ai/home/pendingFirstMessage";
import { createStreamTransport } from "@/shared/lib/ai/transport";
import { isAcpActive } from "@/shared/lib/ai/acp";
import {
  getMessageText,
  getToolInvocation,
  storedMessagesToUI,
  uiMessageToStored,
} from "@/shared/lib/ai/protocol";
import { useMcpChatTools } from "./useMcpChatTools";
import { useAgent } from "@/features/agent/useAgent";
import { executeAgentToolCall } from "@/features/agent/executor";
import { shouldAgentContinue } from "@/features/agent/loop";
import { useAgentStore } from "@/features/agent/store";
import {
  AGENT_TOOL_DEFINITIONS,
  MAX_AGENT_STEPS,
  buildAgentSystemPrompt,
  isAgentTool,
} from "@/features/agent/tools";
import { formatRulesForPrompt, loadProjectRules } from "@/features/agent/rules";

export { getMessageText };

export function useAI() {
  const {
    activeProvider,
    activeModel,
    providers,
    activeCLIProvider,
    cliManifests,
    cliStatuses,
    apiKeyRefs,
    copilotAuth,
    activeChatSessionId,
    chatSessions,
    createChatSession,
    loadSessions,
    loadSessionMessages,
    updateChatSessionMessages,
    saveSessionMessages,
    saveSession,
  } = useAIStore();

  const {
    toolDefinitions,
    resolveTool,
    ready: mcpReady,
    loaded: mcpLoaded,
    serverCount: mcpServerCount,
  } = useMcpChatTools();

  const mcpReadyRef = useRef(mcpReady);
  const mcpServerCountRef = useRef(mcpServerCount);

  useEffect(() => {
    mcpReadyRef.current = mcpReady;
  }, [mcpReady]);

  useEffect(() => {
    mcpServerCountRef.current = mcpServerCount;
  }, [mcpServerCount]);

  const providerConfig = providers[activeProvider];
  const hasAPIKey = apiKeyRefs[activeProvider] !== null;
  const isCLIActive = activeCLIProvider !== null;
  const cliAuthenticated = activeCLIProvider
    ? cliStatuses[activeCLIProvider]?.authenticated === true
    : false;
  const experimentalAcp = useSettingsStore((state) => state.experimental.acp);
  const acpActive = useMemo(
    () => isAcpActive(cliManifests, activeCLIProvider, experimentalAcp),
    [cliManifests, activeCLIProvider, experimentalAcp],
  );

  const sessionId = activeChatSessionId ?? "default";
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const chatRef = useRef<UseChatHelpers<UIMessage> | null>(null);
  // Request-scoped context for the next API call; consumed once so continuations stay clean.
  const pendingContextRef = useRef<string | null>(null);

  const agentEnabled = useSettingsStore((state) => state.agent.enabled);
  const useProjectRules = useSettingsStore((state) => state.agent.useProjectRules);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const agentActive = agentEnabled && agentModeActive;

  const agentToolDefinitions = useMemo(
    () => (agentActive ? AGENT_TOOL_DEFINITIONS : []),
    [agentActive],
  );

  const projectRules = useAgentStore((state) => state.rules);

  useEffect(() => {
    let cancelled = false;
    if (!rootPath || rootPath === "default") {
      useAgentStore.getState().setRules(null);
      return;
    }
    void loadProjectRules(rootPath).then((loaded) => {
      if (!cancelled) useAgentStore.getState().setRules(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  const systemPrompt = useMemo(() => {
    const rules = useProjectRules ? projectRules : null;
    if (agentActive) return buildAgentSystemPrompt(rootPath, rules);
    return formatRulesForPrompt(rules) || undefined;
  }, [agentActive, rootPath, projectRules, useProjectRules]);

  const transport = useMemo<ChatTransport<UIMessage>>(
    () =>
      createStreamTransport(
        activeProvider,
        activeModel,
        providerConfig.baseUrl,
        isCLIActive,
        activeCLIProvider,
        isCLIActive ? [] : [...toolDefinitions, ...agentToolDefinitions],
        rootPath,
        activeChatSessionId,
        acpActive,
        systemPrompt,
        () => {
          const pending = pendingContextRef.current;
          pendingContextRef.current = null;
          return pending;
        },
      ),
    [
      activeProvider,
      activeModel,
      providerConfig.baseUrl,
      isCLIActive,
      activeCLIProvider,
      toolDefinitions,
      agentToolDefinitions,
      rootPath,
      activeChatSessionId,
      acpActive,
      systemPrompt,
    ],
  );

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (activeSession?.messages.length) {
      return storedMessagesToUI(activeSession.messages);
    }
    return [];
  }, [activeSession?.id]);

  const onToolCall = useCallback(
    async ({
      toolCall,
    }: {
      toolCall: {
        toolCallId: string;
        toolName: string;
        input: unknown;
      };
    }) => {
      const chat = chatRef.current;
      if (!chat) return;

      // ACP agents execute tools themselves via reverse-RPC; the frontend only displays results.
      if (acpActive) {
        return;
      }

      if (isAgentTool(toolCall.toolName)) {
        await executeAgentToolCall(chat, rootPath, toolCall);
        return;
      }

      const tool = resolveTool(toolCall.toolName);
      if (!tool) {
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: `Tool ${toolCall.toolName} is not available`,
        });
        return;
      }

      try {
        const result = await invoke<{
          content: unknown;
          is_error?: boolean;
          error?: string;
        }>("mcp_call_tool", {
          id: tool.serverId,
          toolName: tool.toolName,
          arguments: typeof toolCall.input === "object" ? toolCall.input : {},
        });

        const output =
          typeof result.content === "string" ? result.content : JSON.stringify(result.content);

        if (result.is_error || result.error) {
          chat.addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: result.error ?? output,
          });
        } else {
          chat.addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output,
          });
        }
      } catch (err) {
        const errorText = String(err);
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText,
        });
      }
    },
    [resolveTool, acpActive, rootPath],
  );

  const sendAutomaticallyWhen = useCallback(({ messages }: { messages: UIMessage[] }) => {
    // Agent Mode keeps iterating on tool outputs until the model calls
    // agent_task_complete or the step cap is reached.
    const agentState = useAgentStore.getState();
    if (agentState.modeActive && useSettingsStore.getState().agent.enabled) {
      if (agentState.status !== "running" && agentState.status !== "waiting-approval") {
        return false;
      }
      return shouldAgentContinue(messages, agentState.maxSteps);
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return false;

    // Only auto-continue when the assistant message contains a completed tool
    // call but has not produced an answer yet. Once the model generated text,
    // we must not resubmit to avoid an infinite loop.
    if (getMessageText(lastMessage).trim().length > 0) return false;

    return lastMessage.parts.some((part) => {
      const inv = getToolInvocation(part);
      if (!inv) return false;
      return inv.state === "output-available" || inv.state === "output-error";
    });
  }, []);

  const chat = useChat({
    id: `${sessionId}:${activeProvider}:${activeModel}:${activeCLIProvider ?? "api"}`,
    transport,
    messages: initialMessages,
    experimental_throttle: 50,
    onToolCall,
    sendAutomaticallyWhen,
    onFinish: (message) => {
      if (!activeChatSessionId) return;
      if (isCLIActive || !activeModel) return;

      const { chatSessions, generateChatTitle: generateTitle } = useAIStore.getState();
      const session = chatSessions.find((s) => s.id === activeChatSessionId);
      if (!session || session.title !== "New Chat") return;

      const firstUserMsg = session.messages.find((m) => m.role === "user");
      if (!firstUserMsg) return;

      // Only generate a title after the first assistant response finishes.
      if (message.message.role !== "assistant") return;

      void generateTitle(
        activeChatSessionId,
        activeProvider,
        activeModel,
        providerConfig.baseUrl,
        firstUserMsg.content,
      );
    },
  });

  chatRef.current = chat;

  useAgent({ chatRef, chatStatus: chat.status });

  const [input, setInput] = useState("");
  const [lastAttachments, setLastAttachments] = useState<AutoContextAttachment[]>([]);
  const [lastContextTruncated, setLastContextTruncated] = useState(false);

  // Load sessions whenever the workspace changes.
  useEffect(() => {
    void loadSessions(rootPath);
  }, [rootPath, loadSessions]);

  // Load messages for the active session if they are not in memory yet.
  useEffect(() => {
    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (session && session.messages.length === 0) {
      void loadSessionMessages(rootPath, activeChatSessionId);
    }
  }, [activeChatSessionId, rootPath, chatSessions, loadSessionMessages]);

  // When loaded messages arrive for the active session and the chat is empty,
  // populate the chat (e.g. on startup or session switch).
  useEffect(() => {
    if (!activeSession?.messages.length) return;
    if (chat.messages.length === 0 && chat.status === "ready") {
      chat.setMessages(storedMessagesToUI(activeSession.messages));
    }
  }, [activeSession?.messages, chat.messages.length, chat.status, chat.setMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const submitText = useCallback(
    async (raw: string) => {
      if (!raw.trim() || chat.status === "submitted" || chat.status === "streaming") return false;

      const mentions = parseMentions(raw);
      let question = raw.trim();
      const contextParts: string[] = [];

      if (rootPath && mentions.length > 0) {
        try {
          const result = await invoke<ChatContextResult>("read_chat_context", {
            req: { root_path: rootPath, paths: mentions },
          });

          if (result.content) {
            question = stripMentions(raw);
            contextParts.push(result.content);
          }
        } catch {}
      }

      try {
        const autoContext = await collectLiveAutoContext();
        if (autoContext.attachments.length > 0) {
          contextParts.push(buildAutoContextPrompt(autoContext));
        }
        setLastAttachments(autoContext.attachments);
        setLastContextTruncated(autoContext.truncated);
      } catch {
        setLastAttachments([]);
        setLastContextTruncated(false);
      }

      let messageText = question;

      const { edit, submitPrompt } = useAIEditStore.getState();
      if (edit?.status === "composing") {
        messageText = `${messageText}\n\nSelected code from ${edit.filePath}:\n\`\`\`\n${edit.originalCode}\n\`\`\``;
        submitPrompt();
      }

      if (!mcpLoaded) {
        const start = Date.now();
        while (!mcpLoaded && Date.now() - start < 5000) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (mcpServerCountRef.current > 0) {
        const start = Date.now();
        while (!mcpReadyRef.current && Date.now() - start < 5000) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (agentActive) {
        useAgentStore.getState().startTask(messageText, MAX_AGENT_STEPS);
        useAgentStore.getState().setRunSessionId(useAIStore.getState().activeChatSessionId);
      }

      pendingContextRef.current = contextParts.length > 0 ? contextParts.join("\n\n") : null;
      void chat.sendMessage({ text: messageText });
      return true;
    },
    [chat, rootPath, mcpServerCount, mcpLoaded, agentActive],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const submitted = await submitText(input);
      if (submitted) setInput("");
    },
    [input, submitText],
  );

  const pendingSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeChatSessionId || chat.status !== "ready") return;
    if (pendingSessionRef.current === activeChatSessionId) return;

    const pending = takePendingFirstMessage();
    if (pending === null) return;

    pendingSessionRef.current = activeChatSessionId;
    void submitText(pending).then((submitted) => {
      if (!submitted) setPendingFirstMessage(pending);
    });
  }, [activeChatSessionId, chat.status, submitText]);

  // Sync chat messages into the active store session.
  const messagesJsonRef = useRef<string>("");
  useEffect(() => {
    if (!activeChatSessionId) return;

    const snapshot = chat.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: getMessageText(m),
    }));
    const json = JSON.stringify(snapshot);
    if (json === messagesJsonRef.current) return;
    messagesJsonRef.current = json;

    updateChatSessionMessages(activeChatSessionId, chat.messages.map(uiMessageToStored));
  }, [activeChatSessionId, chat.messages, updateChatSessionMessages]);

  // When switching sessions, reset the cached JSON so the new session's messages
  // are synced even if they happen to serialize to the same value.
  useEffect(() => {
    messagesJsonRef.current = "";
  }, [activeChatSessionId]);

  // Persist session metadata and messages to disk.
  const previousPersistRef = useRef<SessionPersistSnapshot>({
    sessionId: null,
    title: null,
    status: chat.status,
  });
  useEffect(() => {
    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (!session) return;

    const previous = previousPersistRef.current;
    const current: SessionPersistSnapshot = {
      sessionId: activeChatSessionId,
      title: session.title,
      status: chat.status,
    };
    previousPersistRef.current = current;

    if (shouldPersistSession(previous, current)) {
      void saveSession(rootPath, session);
    }

    // Save messages when streaming finishes.
    const wasStreaming = previous.status === "streaming" || previous.status === "submitted";
    const isReady = chat.status === "ready";
    if (wasStreaming && isReady) {
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }
  }, [chat.status, activeChatSessionId, rootPath, chatSessions, saveSession, saveSessionMessages]);

  // Debounced persist of messages while typing/streaming.
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (!session) return;

    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    debouncedSaveRef.current = setTimeout(() => {
      // The session may have been deleted while the timeout was pending.
      const stillExists = useAIStore
        .getState()
        .chatSessions.some((s) => s.id === activeChatSessionId);
      if (!stillExists) return;
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }, 1000);

    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [activeChatSessionId, rootPath, chatSessions, saveSessionMessages]);

  const canChat =
    (isCLIActive && cliAuthenticated) ||
    hasAPIKey ||
    activeProvider === "ollama" ||
    (activeProvider === "custom" && Boolean(providerConfig.baseUrl)) ||
    (activeProvider === "copilot" && copilotAuth.authenticated);

  return {
    messages: chat.messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    status: chat.status,
    error: chat.error,
    regenerate: chat.regenerate,
    stop: chat.stop,
    canChat,
    isCLIActive,
    activeCLIProvider,
    sessionId,
    mcpReady,
    mcpLoaded,
    mcpServerCount,
    lastAttachments,
    lastContextTruncated,
    createChatSession: () => {
      return createChatSession(rootPath);
    },
  };
}
