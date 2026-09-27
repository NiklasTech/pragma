import type { AgentEngine } from "@/shared/stores/ai";

export type { AgentEngine, AgentEngineKind } from "@/shared/stores/ai";

export type AgentMemorySource = "agent" | "user";

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
  engine: AgentEngine;
  folders: string[];
  memory: AgentMemoryEntry[];
  createdAt: number;
  updatedAt: number;
}
