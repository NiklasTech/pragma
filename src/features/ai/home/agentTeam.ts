import { MAX_PANES } from "../panes/operations";
import { sameAgent, type QuickChoice } from "../quickStart/quickChoices";

type CliAgent = QuickChoice["agent"];

/** One agent of a start and how many of it run. */
export interface TeamMember {
  agent: CliAgent;
  count: number;
}

export function teamTotal(team: readonly TeamMember[]): number {
  return team.reduce((total, member) => total + member.count, 0);
}

export function memberCount(team: readonly TeamMember[], agent: CliAgent): number | null {
  return team.find((member) => sameAgent(member.agent, agent))?.count ?? null;
}

/** A plain click: only this agent, keeping its count, or the count of the one it replaces. */
export function pickOnly(team: readonly TeamMember[], agent: CliAgent): TeamMember[] {
  const count = memberCount(team, agent) ?? (team.length === 1 ? team[0].count : 1);
  return [{ agent, count }];
}

/** A ⌘-click: adds the agent once, or takes it out while others stay. */
export function toggleMember(team: readonly TeamMember[], agent: CliAgent): TeamMember[] {
  if (memberCount(team, agent) !== null) {
    return team.length > 1 ? team.filter((member) => !sameAgent(member.agent, agent)) : [...team];
  }
  return teamTotal(team) < MAX_PANES ? [...team, { agent, count: 1 }] : [...team];
}

/** Sets one agent's count within the panes a tab holds; zero takes it out unless it is the last. */
export function setMemberCount(
  team: readonly TeamMember[],
  agent: CliAgent,
  count: number,
): TeamMember[] {
  const others = team.filter((member) => !sameAgent(member.agent, agent));
  if (count <= 0 && others.length > 0) return others;
  const room = MAX_PANES - teamTotal(others);
  const clamped = Math.min(Math.max(Math.round(count), 1), room);
  return team.map((member) =>
    sameAgent(member.agent, agent) ? { ...member, count: clamped } : member,
  );
}
