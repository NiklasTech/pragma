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

const STANDARD_PATH = "/ws/.pragma/skills/pdf-processing/SKILL.md";

const STANDARD_SKILL = `---
name: pdf-processing
description: >
  Extract text and tables from PDF files.
  Use when the user works with PDFs.
license: Apache-2.0
allowed-tools: [Read, Grep]
metadata:
  author: example-org
  version: "1.0"
---

# PDF processing

Run scripts/extract.py on the file.
`;

describe("parseSkill with SKILL.md", () => {
  it("accepts a standard skill with YAML front matter, extra fields and a free-form body", () => {
    expect(parseSkill("pdf-processing", STANDARD_PATH, STANDARD_SKILL)).toEqual({
      id: "pdf-processing",
      path: STANDARD_PATH,
      name: "pdf-processing",
      description: "Extract text and tables from PDF files. Use when the user works with PDFs.",
      enabled: true,
      error: null,
    });
  });

  it("reads enabled from YAML", () => {
    const content = STANDARD_SKILL.replace("license:", "enabled: false\nlicense:");
    expect(parseSkill("pdf-processing", STANDARD_PATH, content).enabled).toBe(false);
  });

  it("ignores nested keys when looking for name", () => {
    const content = skillFile("description: D\nmetadata:\n  name: nested", "Body");
    expect(parseSkill("pdf-processing", STANDARD_PATH, content).error).toBe("Missing name");
  });

  it("falls back to reading lines when the YAML is invalid", () => {
    const content = skillFile("name: pdf\ndescription: Use this: when X", "Body");
    const skill = parseSkill("pdf-processing", STANDARD_PATH, content);
    expect(skill.description).toBe("Use this: when X");
    expect(skill.error).toBeNull();
  });

  it("names the folder in the id error", () => {
    const path = "/ws/.pragma/skills/my skill/SKILL.md";
    expect(parseSkill("my skill", path, STANDARD_SKILL).error).toBe(
      "Folder name may only use letters, digits, - and _",
    );
  });

  it("toggles enabled without touching nested front matter", () => {
    const disabled = setSkillEnabled(STANDARD_SKILL, false) ?? "";
    expect(disabled).toContain("metadata:\n  author: example-org\n");
    expect(parseSkill("pdf-processing", STANDARD_PATH, disabled)).toMatchObject({
      enabled: false,
      error: null,
    });
    const enabled = setSkillEnabled(disabled, true) ?? "";
    expect(enabled.match(/enabled:/g)).toHaveLength(1);
    expect(parseSkill("pdf-processing", STANDARD_PATH, enabled).enabled).toBe(true);
  });
});

describe("parseSkill with a legacy file", () => {
  it("keeps values that are not valid YAML as written", () => {
    const content = skillFile("name: Release\ndescription: Use #release: when shipping", BODY);
    expect(parseSkill("release", PATH, content).description).toBe("Use #release: when shipping");
  });

  it("treats a file named SKILL.md directly in the skills folder as legacy", () => {
    const content = skillFile("name: R\ndescription: D", "No headings");
    expect(parseSkill("SKILL", "/ws/.pragma/skills/SKILL.md", content).error).toBe(
      "Missing ## Steps heading",
    );
  });
});
