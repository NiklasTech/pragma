import { create } from "zustand";

import { useAIStore } from "@/shared/stores/ai";

import { cliAgentToPragma } from "./cliAgentCopy";
import { withCliAgents } from "./cliAgentStorage";
import type { ProjectAgentIssue } from "./projectFile";
import {
  deleteProjectAgentFile,
  loadProjectAgents,
  loadProjectMemory,
  saveProjectMemory,
  writeProjectAgent,
  type ProjectMemory,
} from "./projectStorage";
import { agentScope, copyAgentToScope } from "./scope";
import { loadAgentRoster, saveAgentRoster } from "./storage";
import type { Agent, AgentMemoryEntry, AgentMemorySource, AgentScope } from "./types";
import { buildMemoryEntry, validateMemoryEntry } from "./validation";

export type MemoryWriteResult = { ok: true } | { ok: false; error: string };

interface NamedAgentsState {
  /** Project agents first, then personal agents. */
  agents: Agent[];
  personalAgents: Agent[];
  projectAgents: Agent[];
  projectIssues: ProjectAgentIssue[];
  projectRoot: string | null;
  /** Memory of project agents on this machine; null until loaded for `projectRoot`. */
  projectMemory: ProjectMemory | null;
  loaded: boolean;
  loadAgents: () => Promise<void>;
  loadProjectAgents: (rootPath: string | null) => Promise<void>;
  saveAgent: (agent: Agent) => Promise<void>;
  copyAgent: (agent: Agent, scope: AgentScope) => Promise<{ agent: Agent; droppedFolders: number }>;
  /** Writes a discovered agent to `.pragma/agents`, where it then takes precedence. */
  copyCliAgent: (agent: Agent) => Promise<Agent>;
  deleteAgent: (rootPath: string, agentId: string) => Promise<void>;
  appendMemory: (agentId: string, text: string, source: AgentMemorySource) => MemoryWriteResult;
  updateMemory: (agentId: string, entryId: string, text: string) => MemoryWriteResult;
  deleteMemory: (agentId: string, entryId: string) => void;
}

function upsert(agents: Agent[], agent: Agent): Agent[] {
  return agents.some((item) => item.id === agent.id)
    ? agents.map((item) => (item.id === agent.id ? agent : item))
    : [...agents, agent];
}

function withMemory(memory: ProjectMemory, agentId: string, entries: AgentMemoryEntry[]) {
  const next = { ...memory };
  if (entries.length > 0) next[agentId] = entries;
  else delete next[agentId];
  return next;
}

export const useNamedAgentsStore = create<NamedAgentsState>()((set, get) => {
  const setLists = (personalAgents: Agent[], projectAgents: Agent[]) =>
    set({ personalAgents, projectAgents, agents: [...projectAgents, ...personalAgents] });

  const writeMemory = (
    agentId: string,
    updater: (memory: AgentMemoryEntry[]) => AgentMemoryEntry[],
  ) => {
    const { personalAgents, projectAgents, projectRoot, projectMemory } = get();
    const update = (agent: Agent) =>
      agent.id === agentId
        ? { ...agent, memory: updater(agent.memory), updatedAt: Date.now() }
        : agent;

    const project = projectAgents.find((agent) => agent.id === agentId);
    if (project) {
      const nextProject = projectAgents.map(update);
      const memory = withMemory(projectMemory ?? {}, agentId, update(project).memory);
      setLists(personalAgents, nextProject);
      set({ projectMemory: memory });
      if (projectRoot) void saveProjectMemory(projectRoot, memory).catch(() => {});
      return;
    }
    const nextPersonal = personalAgents.map(update);
    setLists(nextPersonal, projectAgents);
    void saveAgentRoster(nextPersonal).catch(() => {});
  };

  return {
    agents: [],
    personalAgents: [],
    projectAgents: [],
    projectIssues: [],
    projectRoot: null,
    projectMemory: null,
    loaded: false,

    loadAgents: async () => {
      try {
        const agents = await loadAgentRoster();
        setLists(agents, get().projectAgents);
        set({ loaded: true });
      } catch {
        set({ loaded: true });
      }
    },

    loadProjectAgents: async (rootPath) => {
      if (rootPath !== get().projectRoot) {
        set({ projectRoot: rootPath, projectIssues: [], projectMemory: null });
        setLists(get().personalAgents, []);
      }
      if (!rootPath) return;

      const [files, memory] = await Promise.all([
        loadProjectAgents(rootPath).then((project) => withCliAgents(rootPath, project)),
        get().projectMemory ?? loadProjectMemory(rootPath).catch((): ProjectMemory => ({})),
      ]);
      if (get().projectRoot !== rootPath) return;
      const current = get().projectMemory ?? memory;
      const agents = files.agents.map((agent) => ({ ...agent, memory: current[agent.id] ?? [] }));
      set({ projectIssues: files.issues, projectMemory: current });
      setLists(get().personalAgents, agents);
    },

    saveAgent: async (agent) => {
      const { personalAgents, projectAgents, projectRoot, projectMemory } = get();
      if (agentScope(agent) === "personal") {
        const agents = upsert(personalAgents, agent);
        setLists(agents, projectAgents);
        await saveAgentRoster(agents);
        return;
      }

      if (!projectRoot) throw new Error("Open a folder to save project agents");
      if (agent.source) throw new Error("Agents from coding CLI folders are read-only");
      await writeProjectAgent(projectRoot, agent);
      setLists(get().personalAgents, upsert(get().projectAgents, agent));
      const stored = projectMemory?.[agent.id] ?? [];
      if (stored !== agent.memory && (stored.length > 0 || agent.memory.length > 0)) {
        const memory = withMemory(get().projectMemory ?? {}, agent.id, agent.memory);
        set({ projectMemory: memory });
        await saveProjectMemory(projectRoot, memory);
      }
    },

    copyAgent: async (agent, scope) => {
      const copy = copyAgentToScope(agent, scope, get().agents, get().projectRoot);
      await get().saveAgent(copy.agent);
      return copy;
    },

    copyCliAgent: async (agent) => {
      const copy = cliAgentToPragma(agent, get().agents);
      await get().saveAgent(copy);
      await get().loadProjectAgents(get().projectRoot);
      return copy;
    },

    deleteAgent: async (rootPath, agentId) => {
      const { personalAgents, projectAgents, projectRoot, projectMemory } = get();
      const isProject = projectAgents.some((agent) => agent.id === agentId);
      const nextPersonal = personalAgents.filter((agent) => agent.id !== agentId);
      const nextProject = projectAgents.filter((agent) => agent.id !== agentId);
      if (isProject && projectRoot) await deleteProjectAgentFile(projectRoot, agentId);
      setLists(nextPersonal, nextProject);

      const { chatSessions, updateChatSession } = useAIStore.getState();
      const owned = chatSessions.filter(
        (session) => session.agentId === agentId && !session.archived,
      );
      for (const session of owned) {
        await updateChatSession(rootPath, { ...session, archived: true, updatedAt: Date.now() });
      }

      if (!isProject) {
        await saveAgentRoster(nextPersonal);
      } else if (projectRoot && projectMemory?.[agentId]) {
        const memory = withMemory(projectMemory, agentId, []);
        set({ projectMemory: memory });
        await saveProjectMemory(projectRoot, memory);
      }
    },

    appendMemory: (agentId, text, source) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent) return { ok: false, error: "Agent not found" };
      const failure = validateMemoryEntry(text, agent.memory);
      if (failure) return { ok: false, error: failure };

      const entry = buildMemoryEntry(text, source);
      writeMemory(agentId, (memory) => [...memory, entry]);
      return { ok: true };
    },

    updateMemory: (agentId, entryId, text) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent) return { ok: false, error: "Agent not found" };
      const others = agent.memory.filter((entry) => entry.id !== entryId);
      const failure = validateMemoryEntry(text, others);
      if (failure) return { ok: false, error: failure };

      writeMemory(agentId, (memory) =>
        memory.map((entry) => (entry.id === entryId ? { ...entry, text } : entry)),
      );
      return { ok: true };
    },

    deleteMemory: (agentId, entryId) => {
      writeMemory(agentId, (memory) => memory.filter((entry) => entry.id !== entryId));
    },
  };
});
