import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { SkillList } from "./SkillList";
import type { Skill } from "./types";

const skills: Skill[] = [
  {
    id: "release",
    path: "/ws/.pragma/skills/release.md",
    name: "Release",
    description: "Ship a release.",
    enabled: true,
    error: null,
  },
  {
    id: "broken",
    path: "/ws/.pragma/skills/broken.md",
    name: "Broken",
    description: "No check.",
    enabled: true,
    error: "Missing ## Check heading",
  },
];

describe("SkillList", () => {
  it("shows each skill and disables the switch of an invalid one", () => {
    const html = renderToStaticMarkup(
      <SkillList skills={skills} isEnabled={() => true} onToggle={() => {}} />,
    );
    expect(html).toContain("Ship a release.");
    expect(html).toContain("Missing ## Check heading");

    const brokenSwitch = /<[a-z]+[^>]*aria-label="Enable Broken"[^>]*>/.exec(html)?.[0] ?? "";
    expect(brokenSwitch).toContain(' data-disabled=""');
    expect(brokenSwitch).toContain('aria-checked="false"');

    const releaseSwitch = /<[a-z]+[^>]*aria-label="Enable Release"[^>]*>/.exec(html)?.[0] ?? "";
    expect(releaseSwitch).not.toContain(' data-disabled=""');
    expect(releaseSwitch).toContain('aria-checked="true"');
  });

  it("offers Convert to SKILL.md only for single-file skills", () => {
    const standard: Skill = {
      ...skills[0],
      id: "pdf",
      path: "/ws/.pragma/skills/pdf/SKILL.md",
      name: "PDF",
    };
    const props = { isEnabled: () => true, onToggle: () => {} };

    const withConvert = renderToStaticMarkup(
      <SkillList skills={[skills[0], standard]} onConvert={() => {}} {...props} />,
    );
    expect(withConvert.match(/Convert to SKILL\.md/g)).toHaveLength(1);

    const withoutConvert = renderToStaticMarkup(<SkillList skills={skills} {...props} />);
    expect(withoutConvert).not.toContain("Convert to SKILL.md");
  });
});
