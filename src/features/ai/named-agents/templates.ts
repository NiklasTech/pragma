import type { Skill } from "@/features/ai/skills/types";

export interface AgentTemplate {
  id: string;
  name: string;
  brief: string;
  /** Workspace skills whose id or name contains one of these words are suggested. */
  skillKeywords: string[];
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "reviewer",
    name: "Reviewer",
    brief:
      "You review code changes. Read the diff and the surrounding code before you judge it. Report bugs, security problems and missing tests first, then readability. Point to the exact file and line, explain why it matters and suggest a fix. Do not rewrite code unless asked.",
    skillKeywords: ["review", "lint", "security"],
  },
  {
    id: "test-writer",
    name: "Test writer",
    brief:
      "You write tests. Find the test framework and conventions the project already uses and follow them. Cover the main behavior, edge cases and failure paths of the code you are pointed at. Run the tests and fix them until they pass, without changing the code under test unless it has a real bug.",
    skillKeywords: ["test", "spec"],
  },
  {
    id: "docs-writer",
    name: "Documentation writer",
    brief:
      "You write and update documentation. Read the code first so every statement is accurate. Keep the existing tone and structure, prefer short sentences and concrete examples, and update README sections, guides and code comments that the change affects.",
    skillKeywords: ["doc", "readme", "writing"],
  },
  {
    id: "refactoring-helper",
    name: "Refactoring helper",
    brief:
      "You refactor code without changing its behavior. Make small, reviewable steps, keep public interfaces stable unless asked, and run the tests after each step. Explain what you changed and why, and stop to ask when a change would alter behavior.",
    skillKeywords: ["refactor", "clean"],
  },
];

export function suggestedSkillIds(template: AgentTemplate, skills: Skill[]): string[] {
  return skills
    .filter((skill) => {
      const haystack = `${skill.id} ${skill.name}`.toLowerCase();
      return template.skillKeywords.some((keyword) => haystack.includes(keyword));
    })
    .map((skill) => skill.id);
}
