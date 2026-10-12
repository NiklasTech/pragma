import { describe, expect, it } from "vite-plus/test";

import { isSkillPath, skillFormat } from "./paths";

describe("skillFormat", () => {
  it("detects the folder layout", () => {
    expect(skillFormat("pdf", "/ws/.pragma/skills/pdf/SKILL.md")).toBe("standard");
    expect(skillFormat("pdf", "C:\\ws\\.pragma\\skills\\pdf\\SKILL.md")).toBe("standard");
    expect(skillFormat("pdf", "/ws/.pragma/skills/pdf.md")).toBe("legacy");
    expect(skillFormat("SKILL", "/ws/.pragma/skills/SKILL.md")).toBe("legacy");
  });
});

describe("isSkillPath", () => {
  it("includes files in skill folders", () => {
    expect(isSkillPath("/ws/.pragma/skills/pdf/SKILL.md")).toBe(true);
    expect(isSkillPath("/ws/.pragma/skills/pdf/scripts/extract.py")).toBe(true);
  });
});
