import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useChat, type UIMessage, type UseChatHelpers } from "@ai-sdk/react";
import { type ChatTransport } from "ai";
import { invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  buildContextUserMessage,
  parseMentions,
  stripMentions,
  type ChatContextResult,
} from "@/shared/lib/chat-context";
import { createStreamTransport } from "@/shared/lib/ai/transport";
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

export { getMessageText };

export function useAI() {
  const {
    activeProvider,
    activeModel,
    providers,
    activeCLIProvider,
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
  const experimentalAcp = useSettingsStore((state) => state.experimental.acp);

  const sessionId = activeChatSessionId ?? "default";
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const chatRef = useRef<UseChatHelpers<UIMessage> | null>(null);

  const agentEnabled = useSettingsStore((state) => state.agent.enabled);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const agentActive = agentEnabled && agentModeActive;

  const agentToolDefinitions = useMemo(
    () => (agentActive ? AGENT_TOOL_DEFINITIONS : []),
    [agentActive],
  );
  const agentSystemPrompt = useMemo(
    () => (agentActive ? buildAgentSystemPrompt(rootPath) : undefined),
    [agentActive, rootPath],
  );

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
        experimentalAcp,
        agentSystemPrompt,
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
      experimentalAcp,
      agentSystemPrompt,
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

      // Kimi ACP executes tools itself via reverse-RPC; the frontend only displays results.
      if (activeCLIProvider === "moonshot-kimi" && experimentalAcp) {
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
    [resolveTool, activeCLIProvider, experimentalAcp, rootPath],
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || chat.status === "submitted" || chat.status === "streaming") return;

      const mentions = parseMentions(input);
      let messageText = input.trim();

      if (rootPath && mentions.length > 0) {
        try {
          const result = await invoke<ChatContextResult>("read_chat_context", {
            req: { root_path: rootPath, paths: mentions },
          });

          if (result.content) {
            const question = stripMentions(input);
            messageText = buildContextUserMessage(result.content, question);
          }
        } catch {}
      }

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
      }

      void chat.sendMessage({ text: messageText });
      setInput("");
    },
    [input, chat, rootPath, mcpServerCount, mcpLoaded, agentActive],
  );

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
  const previousStatusRef = useRef(chat.status);
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = chat.status;

    if (!activeChatSessionId) return;
    const session = chatSessions.find((s) => s.id === activeChatSessionId);
    if (!session) return;

    // Save metadata whenever the title changes.
    void saveSession(rootPath, session);

    // Save messages when streaming finishes or when the message list grows.
    const wasStreaming = previous === "streaming" || previous === "submitted";
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
      void saveSessionMessages(rootPath, activeChatSessionId, session.messages);
    }, 1000);

    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [activeChatSessionId, rootPath, chatSessions, saveSessionMessages]);

  const canChat =
    isCLIActive ||
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
    createChatSession: () => {
      return createChatSession(rootPath);
    },
  };
}
