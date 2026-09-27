import { describe, expect, it } from "vite-plus/test";

import { buildSkillTemplate, parseSkill, setSkillEnabled } from "./parse";

const PATH = "/ws/.pragma/skills/release.md";

function skillFile(frontMatter: string, body: string): string {
  return `---\n${frontMatter}\n---\n\n${body}`;
}

const BODY = "## Steps\n\n1. Do it\n\n## Check\n\n- It works\n\n## Needs approval\n\n- Pushing\n";

describe("parseSkill", () => {
  it("reads name, description and the default enabled state", () => {
    const skill = parseSkill(
      "release",
      PATH,
      skillFile("name: Release\ndescription: Ship it.", BODY),
    );
    expect(skill).toEqual({
      id: "release",
      path: PATH,
      name: "Release",
      description: "Ship it.",
      enabled: true,
      error: null,
    });
  });

  it("honors enabled: false and quoted values", () => {
    const skill = parseSkill(
      "release",
      PATH,
      skillFile("name: \"Release\"\ndescription: 'Ship it.'\nenabled: false", BODY),
    );
    expect(skill.name).toBe("Release");
    expect(skill.description).toBe("Ship it.");
    expect(skill.enabled).toBe(false);
    expect(skill.error).toBeNull();
  });

  it("reports a missing Check heading", () => {
    const body = "## Steps\n\n1. Do it\n\n## Needs approval\n\n- Pushing\n";
    const skill = parseSkill(
      "release",
      PATH,
      skillFile("name: Release\ndescription: Ship it.", body),
    );
    expect(skill.error).toBe("Missing ## Check heading");
  });

  it("reports headings out of order", () => {
    const body = "## Check\n\n## Steps\n\n## Needs approval\n";
    const skill = parseSkill(
      "release",
      PATH,
      skillFile("name: Release\ndescription: Ship it.", body),
    );
    expect(skill.error).toMatch(/in order/);
  });

  it("reports missing front matter fields", () => {
    expect(parseSkill("release", PATH, BODY).error).toBe("Missing front matter");
    expect(parseSkill("release", PATH, skillFile("description: Ship it.", BODY)).error).toBe(
      "Missing name",
    );
    expect(parseSkill("release", PATH, skillFile("name: Release", BODY)).error).toBe(
      "Missing description",
    );
    expect(
      parseSkill("release", PATH, skillFile("name: R\ndescription: D\nenabled: yes", BODY)).error,
    ).toBe("enabled must be true or false");
  });

  it("rejects file names that are not valid ids", () => {
    const skill = parseSkill("my skill", PATH, skillFile("name: R\ndescription: D", BODY));
    expect(skill.error).not.toBeNull();
  });

  it("accepts the template", () => {
    expect(parseSkill("new-skill", PATH, buildSkillTemplate("New skill")).error).toBeNull();
  });
});

describe("setSkillEnabled", () => {
  it("adds and replaces the enabled field", () => {
    const original = skillFile("name: Release\ndescription: Ship it.", BODY);
    const disabled = setSkillEnabled(original, false);
    expect(disabled).not.toBeNull();
    expect(parseSkill("release", PATH, disabled ?? "").enabled).toBe(false);

    const enabled = setSkillEnabled(disabled ?? "", true) ?? "";
    expect(enabled.match(/enabled:/g)).toHaveLength(1);
    expect(parseSkill("release", PATH, enabled).enabled).toBe(true);
    expect(enabled.endsWith(BODY)).toBe(true);
  });

  it("returns null without front matter", () => {
    expect(setSkillEnabled(BODY, true)).toBeNull();
  });
});
