import type { AgentEngine } from "@/shared/stores/ai";

export type { AgentEngine, AgentEngineKind } from "@/shared/stores/ai";

export type AgentMemorySource = "agent" | "user";

/** Project agents live in `.pragma/agents/`, personal agents in the roster of this machine. */
export type AgentScope = "personal" | "project";

export interface AgentMemoryEntry {
  id: string;
  text: string;
  createdAt: number;
  source: AgentMemorySource;
}

export interface Agent {
  id: string;
  name: string;
  brief: string;
  description?: string;
  engine: AgentEngine;
  folders: string[];
  memory: AgentMemoryEntry[];
  skills: string[];
  /** MCP servers the agent uses; unset means all configured servers. */
  mcpServers?: string[];
  /** Unset for agents in the personal roster. */
  scope?: AgentScope;
  /** The coding CLI folder a discovered project agent was read from; such agents are read-only. */
  source?: string;
  createdAt: number;
  updatedAt: number;
}
