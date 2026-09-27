import { describe, expect, it } from "vite-plus/test";

import { formatSkillCatalog, selectCatalogSkills } from "./catalog";
import { isSkillPath, skillsDir } from "./paths";
import type { Skill } from "./types";

function skill(id: string, enabled: boolean, error: string | null = null): Skill {
  return {
    id,
    path: `/ws/.pragma/skills/${id}.md`,
    name: `Name ${id}`,
    description: `Description ${id}`,
    enabled,
    error,
  };
}

const skills = [skill("a", true), skill("b", false), skill("c", true, "Missing ## Check heading")];

describe("selectCatalogSkills", () => {
  it("uses the workspace switch without a named agent", () => {
    expect(selectCatalogSkills(skills, null).map((s) => s.id)).toEqual(["a"]);
  });

  it("uses the agent's own list for a named agent", () => {
    expect(selectCatalogSkills(skills, ["b", "c"]).map((s) => s.id)).toEqual(["b"]);
  });
});

describe("formatSkillCatalog", () => {
  it("lists name, description and path but not the body", () => {
    const catalog = formatSkillCatalog([skill("a", true)]) ?? "";
    expect(catalog).toContain("- Name a: Description a (/ws/.pragma/skills/a.md)");
    expect(catalog).toContain("read the skill file");
    expect(catalog).not.toContain("## Steps");
  });

  it("returns null when no skill is enabled", () => {
    expect(formatSkillCatalog([])).toBeNull();
  });
});

describe("skill paths", () => {
  it("detects files under .pragma/skills", () => {
    expect(isSkillPath(`${skillsDir("/ws/")}/a.md`)).toBe(true);
    expect(isSkillPath("C:\\ws\\.pragma\\skills\\a.md")).toBe(true);
    expect(isSkillPath("/ws/.pragma/extensions/a.md")).toBe(false);
    expect(isSkillPath("/ws/skills/a.md")).toBe(false);
  });
});
