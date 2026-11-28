import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../tasks/storage", () => ({
  loadTasks: vi.fn(async () => [
    {
      id: "t1",
      title: "Fix login",
      notes: "",
      status: "todo",
      result: "",
      priority: "high",
      labels: ["auth"],
      createdAt: 1,
      updatedAt: 1,
    },
  ]),
  saveTasks: vi.fn(async () => {}),
}));

const { TASK_TOOLS } = await import("./taskTools");
const { useTasksStore } = await import("../tasks/store");

const context = { sessionId: "s1", requestId: "r1", cwd: "/p", rootPath: "/p" };

describe("TASK_TOOLS", () => {
  beforeEach(() => useTasksStore.setState({ byRoot: {} }));

  it("loads and lists the board", async () => {
    await expect(TASK_TOOLS.tasks_list({}, context)).resolves.toBe(
      "t1  [todo, high, auth]  Fix login",
    );
  });

  it("adds a task in To do", async () => {
    const text = await TASK_TOOLS.task_create(
      { title: " Write docs ", priority: "low", labels: ["docs", ""] },
      context,
    );
    expect(text).toMatch(/^Added task .+: Write docs$/);
    const added = useTasksStore.getState().byRoot["/p"].tasks[1];
    expect(added).toMatchObject({
      title: "Write docs",
      status: "todo",
      priority: "low",
      labels: ["docs"],
    });
    await expect(
      TASK_TOOLS.task_create({ title: "x", priority: "urgent" }, context),
    ).rejects.toThrow("priority must be one of");
    await expect(TASK_TOOLS.task_create({ title: "" }, context)).rejects.toThrow("Title");
  });

  it("updates status, result and title of a task", async () => {
    await expect(
      TASK_TOOLS.task_update({ task: "t1", status: "in_review", result: "Fixed" }, context),
    ).resolves.toBe("Updated task t1  [in_review, high, auth]  Fix login");
    expect(useTasksStore.getState().byRoot["/p"].tasks[0]).toMatchObject({
      status: "in_review",
      result: "Fixed",
    });
    await expect(TASK_TOOLS.task_update({ task: "nope" }, context)).rejects.toThrow("No task nope");
    await expect(TASK_TOOLS.task_update({ task: "t1", status: "later" }, context)).rejects.toThrow(
      "status must be one of",
    );
  });
});
