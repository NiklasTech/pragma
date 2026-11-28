import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ choose: vi.fn(), resolve: vi.fn() }));
vi.mock("@/features/ai/children/acpSpawn", () => ({
  chooseSpawnOption: mocks.choose,
  resolveSpawnApproval: mocks.resolve,
}));
vi.mock("@/features/ai/acp/acpApprovals", () => ({ resolveAcpApproval: vi.fn() }));
vi.mock("@/features/agent/executor", () => ({ stepLabel: () => ({ label: "Rename symbol" }) }));

const { questionChoices, questionSummary } = await import("./questionChoices");

const entry = { sessionId: "s1", leafId: "", tabId: "", tabNumber: 0 };
const question = {
  kind: "spawn" as const,
  entry,
  approval: {
    toolCallId: "r1",
    toolName: "ask_user",
    description: "Which database?",
    options: ["Postgres", "SQLite"],
    resolve: () => {},
  },
};

describe("a question with options", () => {
  it("offers each option on a number key, then dismiss and go to pane", () => {
    const choices = questionChoices(question, () => {});
    expect(choices.map((choice) => [choice.key, choice.label])).toEqual([
      ["1", "Postgres"],
      ["2", "SQLite"],
      ["n", "dismiss"],
      ["⏎", "go to pane"],
    ]);
    choices[1].run();
    expect(mocks.choose).toHaveBeenCalledWith("s1", "r1", "SQLite");
    choices[2].run();
    expect(mocks.resolve).toHaveBeenCalledWith("s1", "r1", false);
  });

  it("reads as the agent asking its question", () => {
    expect(questionSummary(question, "Claude")).toEqual({
      text: "Claude asks",
      request: "Which database?",
    });
  });
});
