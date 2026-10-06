import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useChat, type UIMessage, type UseChatHelpers } from "@ai-sdk/react";
import { type ChatTransport } from "ai";
import { toast } from "sonner";

import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { sessionCwd } from "@/features/ai/worktree/cwd";
import { type AutoContextAttachment } from "@/shared/lib/chat-context";
import { collectLiveAutoContext } from "@/features/ai/context/liveContext";
import { buildAutoContextPrompt } from "@/features/ai/context/autoContext";
import {
  setPendingFirstMessage,
  takePendingFirstMessage,
} from "@/features/ai/home/pendingFirstMessage";
import { createStreamTransport } from "@/shared/lib/ai/transport";
import { isAcpActive } from "@/shared/lib/ai/acp";
import { pinnedSessionEngine, resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import { getMessageText, storedMessagesToUI } from "@/shared/lib/ai/protocol";
import { imageToFilePart } from "@/shared/lib/ai/images";
import type { ChatImage } from "@/shared/stores/ai";
import { useMcpChatTools } from "./useMcpChatTools";
import { useChatPrompt } from "./useChatPrompt";
import { useChatSessionLoading, useChatSessionPersistence } from "./useChatSessionSync";
import { runChatToolCall, shouldAutoContinueChat } from "./chatToolCall";
import { resolveMentionContext } from "./chatMentionContext";
import { mcpSelectionKey, resolveMcpServerIds } from "@/features/ai/mcp/selection";
import { expandPromptCommand } from "@/features/ai/mcp/prompts";
import { useAgent } from "@/features/agent/useAgent";
import { useAgentStore } from "@/features/agent/store";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { compactIfNeeded } from "@/features/ai/compaction/compactSession";
import { useLiveChatRegistration } from "@/features/ai/compaction/liveChat";

export { getMessageText };

export function useAI() {
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const providers = useAIStore((state) => state.providers);
  const activeCLIProvider = useAIStore((state) => state.activeCLIProvider);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const cliStatuses = useAIStore((state) => state.cliStatuses);
  const apiKeyRefs = useAIStore((state) => state.apiKeyRefs);
  const copilotAuth = useAIStore((state) => state.copilotAuth);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const createChatSession = useAIStore((state) => state.createChatSession);

  const sessionId = activeChatSessionId ?? "default";
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const cwd = sessionCwd(activeSession, rootPath);

  const agents = useNamedAgentsStore((state) => state.agents);
  const activeAgent = activeSession?.agentId
    ? (agents.find((agent) => agent.id === activeSession.agentId) ?? null)
    : null;

  const mcpKey = mcpSelectionKey(resolveMcpServerIds(activeSession, activeAgent));
  const mcpServerIds = useMemo(
    () => (mcpKey === "*" ? null : mcpKey.split("\n").filter(Boolean)),
    [mcpKey],
  );

  const {
    toolDefinitions,
    resolveTool,
    ready: mcpReady,
    loaded: mcpLoaded,
    serverCount: mcpServerCount,
  } = useMcpChatTools(mcpServerIds);

  const mcpReadyRef = useRef(mcpReady);
  const mcpServerCountRef = useRef(mcpServerCount);

  useEffect(() => {
    mcpReadyRef.current = mcpReady;
  }, [mcpReady]);

  useEffect(() => {
    mcpServerCountRef.current = mcpServerCount;
  }, [mcpServerCount]);

  const {
    cliProviderId: effectiveCLIProvider,
    provider: effectiveProvider,
    model: effectiveModel,
    baseUrl: effectiveBaseUrl,
  } = resolveEffectiveEngine(pinnedSessionEngine(activeSession), {
    activeCLIProvider,
    activeProvider,
    activeModel,
    providers,
  });
  const hasAPIKey = apiKeyRefs[effectiveProvider] !== null;
  const isCLIActive = effectiveCLIProvider !== null;
  const cliAuthenticated = effectiveCLIProvider
    ? cliStatuses[effectiveCLIProvider]?.authenticated === true
    : false;
  const experimentalAcp = useSettingsStore((state) => state.experimental.acp);
  const acpActive = useMemo(
    () => isAcpActive(cliManifests, effectiveCLIProvider, experimentalAcp),
    [cliManifests, effectiveCLIProvider, experimentalAcp],
  );

  const chatRef = useRef<UseChatHelpers<UIMessage> | null>(null);
  // Request-scoped context for the next API call; consumed once so continuations stay clean.
  const pendingContextRef = useRef<string | null>(null);

  const { agentActive, agentToolDefinitions, systemPrompt, leadingSystemMessage, agentAccess } =
    useChatPrompt({ activeSession, activeAgent, cwd, rootPath });
  const activeSessionKind = activeSession?.kind;

  const transport = useMemo<ChatTransport<UIMessage>>(
    () =>
      createStreamTransport(
        effectiveProvider,
        effectiveModel,
        effectiveBaseUrl,
        isCLIActive,
        effectiveCLIProvider,
        isCLIActive ? [] : [...toolDefinitions, ...agentToolDefinitions],
        cwd,
        activeChatSessionId,
        acpActive,
        systemPrompt,
        leadingSystemMessage,
        () => {
          const pending = pendingContextRef.current;
          pendingContextRef.current = null;
          return pending;
        },
        activeSessionKind !== "ask",
        mcpServerIds,
        (usage) => {
          if (activeChatSessionId) {
            useAIStore.getState().recordSessionUsage(activeChatSessionId, usage);
          }
        },
      ),
    [
      effectiveProvider,
      effectiveModel,
      effectiveBaseUrl,
      isCLIActive,
      effectiveCLIProvider,
      toolDefinitions,
      agentToolDefinitions,
      cwd,
      activeChatSessionId,
      acpActive,
      systemPrompt,
      leadingSystemMessage,
      activeSessionKind,
      mcpServerIds,
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
      await runChatToolCall(chat, toolCall, { acpActive, cwd, agentAccess, resolveTool });
    },
    [resolveTool, acpActive, cwd, agentAccess],
  );

  // Coding CLIs run their own tools; their tool calls are reports, never work for Pragma to continue.
  const cliActiveRef = useRef(isCLIActive);
  cliActiveRef.current = isCLIActive;

  const sendAutomaticallyWhen = useCallback(({ messages }: { messages: UIMessage[] }) => {
    if (cliActiveRef.current) return false;
    return shouldAutoContinueChat(messages);
  }, []);

  const chat = useChat({
    id: `${sessionId}:${effectiveProvider}:${effectiveModel}:${effectiveCLIProvider ?? "api"}`,
    transport,
    messages: initialMessages,
    experimental_throttle: 50,
    onToolCall,
    sendAutomaticallyWhen,
    onFinish: (message) => {
      if (!activeChatSessionId) return;

      const { chatSessions, generateChatTitle: generateTitle } = useAIStore.getState();
      const session = chatSessions.find((s) => s.id === activeChatSessionId);
      if (!session || session.title !== "New Chat") return;

      const firstUserMsg = session.messages.find((m) => m.role === "user");
      if (!firstUserMsg) return;

      // Only generate a title after the first assistant response finishes.
      if (message.message.role !== "assistant") return;

      void generateTitle(
        rootPath,
        activeChatSessionId,
        firstUserMsg.content,
        isCLIActive || !effectiveModel
          ? null
          : { provider: effectiveProvider, model: effectiveModel, baseUrl: effectiveBaseUrl },
      );
    },
  });

  chatRef.current = chat;
  useLiveChatRegistration(activeChatSessionId, chatRef);

  useAgent({ chatRef, chatStatus: chat.status });

  const [input, setInput] = useState("");
  const [lastAttachments, setLastAttachments] = useState<AutoContextAttachment[]>([]);
  const [lastContextTruncated, setLastContextTruncated] = useState(false);

  useChatSessionLoading({ chat, rootPath, activeChatSessionId, chatSessions, activeSession });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const submitText = useCallback(
    async (raw: string, images: ChatImage[] = [], options: { replaceMessageId?: string } = {}) => {
      if (!raw.trim() && images.length === 0) return false;
      if (chat.status === "submitted" || chat.status === "streaming") return false;

      if (agentActive && activeSession?.worktree?.status === "error") {
        toast.error("This thread has no working worktree. Check the setup log before starting.");
        return false;
      }

      try {
        raw = await expandPromptCommand(raw, mcpServerIds);
      } catch (err) {
        toast.error(`Could not load the MCP prompt: ${String(err)}`);
        return false;
      }

      const mentionContext = await resolveMentionContext(raw, rootPath);
      if (!mentionContext) return false;
      const { question, contextParts } = mentionContext;

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

      // An edit drops the later messages, and compaction could remove the message it replaces.
      if (!isCLIActive && activeChatSessionId && !options.replaceMessageId) {
        await compactIfNeeded(activeChatSessionId);
      }

      if (agentActive && !isCLIActive) {
        useAgentStore
          .getState()
          .startTask(messageText, useSettingsStore.getState().agent.stepLimit);
        useAgentStore.getState().setRunSessionId(useAIStore.getState().activeChatSessionId);
      }

      pendingContextRef.current = contextParts.length > 0 ? contextParts.join("\n\n") : null;
      void chat.sendMessage({
        text: messageText,
        files: images.map(imageToFilePart),
        messageId: options.replaceMessageId,
      });
      return true;
    },
    [
      chat,
      rootPath,
      mcpServerCount,
      mcpLoaded,
      agentActive,
      isCLIActive,
      activeSession,
      mcpServerIds,
      activeChatSessionId,
    ],
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

  useChatSessionPersistence({
    chat,
    chatRef,
    rootPath,
    activeChatSessionId,
    chatSessions,
    agentActive,
  });

  const canChat =
    (isCLIActive && cliAuthenticated) ||
    hasAPIKey ||
    effectiveProvider === "ollama" ||
    (effectiveProvider === "custom" && Boolean(effectiveBaseUrl)) ||
    (effectiveProvider === "copilot" && copilotAuth.authenticated);

  const regenerate = useCallback(() => {
    // A retry in Agent Mode is a fresh run; a failed run would otherwise block auto-continue.
    if (agentActive && !isCLIActive) {
      const lastUser = [...chat.messages].reverse().find((message) => message.role === "user");
      useAgentStore
        .getState()
        .startTask(
          lastUser ? getMessageText(lastUser) : "",
          useSettingsStore.getState().agent.stepLimit,
        );
      useAgentStore.getState().setRunSessionId(useAIStore.getState().activeChatSessionId);
    }
    return chat.regenerate();
  }, [agentActive, isCLIActive, chat]);

  return {
    messages: chat.messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    submitText,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    status: chat.status,
    error: chat.error,
    regenerate,
    setMessages: chat.setMessages,
    stop: chat.stop,
    canChat,
    isCLIActive,
    activeCLIProvider: effectiveCLIProvider,
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
