import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentPlan } from "./AgentPlan";

describe("AgentPlan", () => {
  it("shows the tasks and the progress", () => {
    const html = renderToStaticMarkup(
      <AgentPlan
        entries={[
          { content: "Read the code", priority: "high", status: "completed" },
          { content: "Write the tests", priority: "medium", status: "in_progress" },
        ]}
      />,
    );
    expect(html).toContain("1 of 2 done");
    expect(html).toContain("Read the code");
    expect(html).toContain("Write the tests");
  });

  it("renders nothing without a plan", () => {
    expect(renderToStaticMarkup(<AgentPlan entries={[]} />)).toBe("");
  });
});
