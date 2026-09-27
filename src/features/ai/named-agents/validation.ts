import type { Agent, AgentMemoryEntry } from "./types";

export const AGENT_NAME_MAX = 40;
export const AGENT_BRIEF_MAX = 4000;
export const MEMORY_TEXT_MAX = 500;
export const MEMORY_ENTRY_MAX = 50;
export const MEMORY_TOTAL_MAX = 16000;

const SECRET_MARKERS = ["sk-", "ghp_", "github_pat_", "xai-", "Bearer "];

export type MemoryFailure =
  | "Memory is full"
  | "Do not store secrets in memory"
  | "Memory text is too long";

export function containsSecret(text: string): boolean {
  return SECRET_MARKERS.some((marker) => text.includes(marker));
}

export function isAgentNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= AGENT_NAME_MAX;
}

export function isAgentNameUnique(name: string, agents: Agent[], excludeId?: string): boolean {
  const target = name.trim().toLowerCase();
  return !agents.some(
    (agent) => agent.id !== excludeId && agent.name.trim().toLowerCase() === target,
  );
}

export function isAgentBriefValid(brief: string): boolean {
  const trimmed = brief.trim();
  return trimmed.length >= 1 && trimmed.length <= AGENT_BRIEF_MAX;
}

export function memoryTotalChars(memory: AgentMemoryEntry[]): number {
  return memory.reduce((total, entry) => total + entry.text.length, 0);
}

export function validateMemoryEntry(
  text: string,
  memory: AgentMemoryEntry[],
): MemoryFailure | null {
  if (containsSecret(text)) return "Do not store secrets in memory";
  if (text.length > MEMORY_TEXT_MAX) return "Memory text is too long";
  if (memory.length >= MEMORY_ENTRY_MAX) return "Memory is full";
  if (memoryTotalChars(memory) + text.length > MEMORY_TOTAL_MAX) return "Memory is full";
  return null;
}

export function buildMemoryEntry(
  text: string,
  source: AgentMemoryEntry["source"],
): AgentMemoryEntry {
  return { id: crypto.randomUUID(), text, createdAt: Date.now(), source };
}
