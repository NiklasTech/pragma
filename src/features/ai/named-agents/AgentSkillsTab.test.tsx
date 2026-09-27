import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentSkillsTab } from "./AgentSkillsTab";

describe("AgentSkillsTab", () => {
  it("shows the disabled Skills text", () => {
    const html = renderToStaticMarkup(<AgentSkillsTab />);
    expect(html).toContain("Skills are not available yet");
  });
});
