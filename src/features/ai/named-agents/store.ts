import { create } from "zustand";

import { useAIStore } from "@/shared/stores/ai";

import { loadAgentRoster, saveAgentRoster } from "./storage";
import type { Agent, AgentMemoryEntry, AgentMemorySource } from "./types";
import { buildMemoryEntry, validateMemoryEntry } from "./validation";

export type MemoryWriteResult = { ok: true } | { ok: false; error: string };

interface NamedAgentsState {
  agents: Agent[];
  loaded: boolean;
  loadAgents: () => Promise<void>;
  saveAgent: (agent: Agent) => Promise<void>;
  deleteAgent: (rootPath: string, agentId: string) => Promise<void>;
  appendMemory: (agentId: string, text: string, source: AgentMemorySource) => MemoryWriteResult;
  updateMemory: (agentId: string, entryId: string, text: string) => MemoryWriteResult;
  deleteMemory: (agentId: string, entryId: string) => void;
}

function updateAgentMemory(
  agents: Agent[],
  agentId: string,
  updater: (memory: AgentMemoryEntry[]) => AgentMemoryEntry[],
): Agent[] {
  return agents.map((agent) =>
    agent.id === agentId
      ? { ...agent, memory: updater(agent.memory), updatedAt: Date.now() }
      : agent,
  );
}

export const useNamedAgentsStore = create<NamedAgentsState>()((set, get) => ({
  agents: [],
  loaded: false,

  loadAgents: async () => {
    try {
      const agents = await loadAgentRoster();
      set({ agents, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  saveAgent: async (agent) => {
    const exists = get().agents.some((item) => item.id === agent.id);
    const agents = exists
      ? get().agents.map((item) => (item.id === agent.id ? agent : item))
      : [...get().agents, agent];
    set({ agents });
    await saveAgentRoster(agents);
  },

  deleteAgent: async (rootPath, agentId) => {
    const agents = get().agents.filter((agent) => agent.id !== agentId);
    set({ agents });

    const { chatSessions, updateChatSession } = useAIStore.getState();
    const owned = chatSessions.filter(
      (session) => session.agentId === agentId && !session.archived,
    );
    for (const session of owned) {
      await updateChatSession(rootPath, { ...session, archived: true, updatedAt: Date.now() });
    }

    await saveAgentRoster(agents);
  },

  appendMemory: (agentId, text, source) => {
    const agent = get().agents.find((item) => item.id === agentId);
    if (!agent) return { ok: false, error: "Agent not found" };
    const failure = validateMemoryEntry(text, agent.memory);
    if (failure) return { ok: false, error: failure };

    const entry = buildMemoryEntry(text, source);
    const agents = updateAgentMemory(get().agents, agentId, (memory) => [...memory, entry]);
    set({ agents });
    void saveAgentRoster(agents).catch(() => {});
    return { ok: true };
  },

  updateMemory: (agentId, entryId, text) => {
    const agent = get().agents.find((item) => item.id === agentId);
    if (!agent) return { ok: false, error: "Agent not found" };
    const others = agent.memory.filter((entry) => entry.id !== entryId);
    const failure = validateMemoryEntry(text, others);
    if (failure) return { ok: false, error: failure };

    const agents = updateAgentMemory(get().agents, agentId, (memory) =>
      memory.map((entry) => (entry.id === entryId ? { ...entry, text } : entry)),
    );
    set({ agents });
    void saveAgentRoster(agents).catch(() => {});
    return { ok: true };
  },

  deleteMemory: (agentId, entryId) => {
    const agents = updateAgentMemory(get().agents, agentId, (memory) =>
      memory.filter((entry) => entry.id !== entryId),
    );
    set({ agents });
    void saveAgentRoster(agents).catch(() => {});
  },
}));
