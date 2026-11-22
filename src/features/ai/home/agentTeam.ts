import { MAX_PANES } from "../panes/operations";
import { sameAgent, type QuickChoice } from "../quickStart/quickChoices";

export type CliAgent = QuickChoice["agent"];

/** A plain click: only this agent takes the tasks. */
export function pickOnly(agent: CliAgent): CliAgent[] {
  return [agent];
}

/** A ⌘-click: adds the agent to the ones the tasks are spread over, or takes it out while others stay. */
export function togglePoolAgent(pool: readonly CliAgent[], agent: CliAgent): CliAgent[] {
  if (pool.some((member) => sameAgent(member, agent))) {
    return pool.length > 1 ? pool.filter((member) => !sameAgent(member, agent)) : [...pool];
  }
  return pool.length < MAX_PANES ? [...pool, agent] : [...pool];
}

/** The tasks of a start, one per line, at most as many as a tab holds panes. */
export function splitTasks(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_PANES);
}

/** Who runs each task: the agent picked for it, else the pool in turn, so every account gets work. */
export function assignTasks(
  taskCount: number,
  pool: readonly CliAgent[],
  picked: Readonly<Record<number, CliAgent>>,
): CliAgent[] {
  if (pool.length === 0) return [];
  return Array.from(
    { length: taskCount },
    (_, index) => picked[index] ?? pool[index % pool.length],
  );
}
