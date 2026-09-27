import type { Skill } from "./types";

export function selectCatalogSkills(skills: Skill[], agentSkillIds: string[] | null): Skill[] {
  return skills.filter(
    (skill) =>
      skill.error === null && (agentSkillIds ? agentSkillIds.includes(skill.id) : skill.enabled),
  );
}

export function formatSkillCatalog(skills: Skill[]): string | null {
  if (skills.length === 0) return null;
  return [
    "Skills for this workspace. A skill is a procedure in a markdown file. When a task matches a skill's description, read the skill file with the read-file tool before you follow it.",
    ...skills.map((skill) => `- ${skill.name}: ${skill.description} (${skill.path})`),
  ].join("\n");
}
