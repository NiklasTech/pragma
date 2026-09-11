import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentRunBar } from "./AgentRunBar";

const agent = vi.hoisted(() => ({
  state: {
    status: "idle",
    stepCount: 0,
    maxSteps: 30,
    todos: [] as Array<{ id: string; content: string; status: string }>,
    editReviews: [] as Array<unknown>,
    requestStop: () => {},
  },
}));

vi.mock("@/features/agent/store", () => ({
  useAgentStore: (selector: (state: typeof agent.state) => unknown) => selector(agent.state),
}));

function resetAgent() {
  agent.state.status = "idle";
  agent.state.stepCount = 0;
  agent.state.maxSteps = 30;
  agent.state.todos = [];
  agent.state.editReviews = [];
}

describe("AgentRunBar", () => {
  beforeEach(resetAgent);

  it("renders nothing while the agent is idle", () => {
    expect(renderToStaticMarkup(<AgentRunBar />)).toBe("");
  });

  it("shows status, step count and stop while running", () => {
    agent.state.status = "running";
    agent.state.stepCount = 2;
    const html = renderToStaticMarkup(<AgentRunBar />);
    expect(html).toContain("Running");
    expect(html).toContain("Step 2 of 30");
    expect(html).toContain('aria-label="Stop agent"');
  });

  it("shows the todo list", () => {
    agent.state.status = "running";
    agent.state.stepCount = 1;
    agent.state.todos = [{ id: "todo-1", content: "Read the store", status: "in_progress" }];
    const html = renderToStaticMarkup(<AgentRunBar />);
    expect(html).toContain("Todos");
    expect(html).toContain("Read the store");
  });

  it("hints while waiting for approval", () => {
    agent.state.status = "waiting-approval";
    agent.state.stepCount = 3;
    const html = renderToStaticMarkup(<AgentRunBar />);
    expect(html).toContain("Waiting for approval");
    expect(html).toContain('aria-label="Stop agent"');
  });
});
