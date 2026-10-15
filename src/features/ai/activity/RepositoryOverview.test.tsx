import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

const stores = vi.hoisted(() => ({
  paths: [] as string[],
  entries: {} as Record<string, { state: string; since: number }>,
}));

const tasks = vi.hoisted(() => ({
  byRoot: {} as Record<
    string,
    { tasks: Array<{ id: string; status: string }>; loaded: boolean; loadFailed: boolean }
  >,
}));

const ai = vi.hoisted(() => ({
  chatSessions: [] as Array<{
    id: string;
    rootPath: string;
    title: string;
    messages: unknown[];
    createdAt: number;
    updatedAt: number;
  }>,
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: (selector: (state: typeof ai) => unknown) => selector(ai),
}));

vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: (selector: (state: { rootPath: string | null }) => unknown) =>
    selector({ rootPath: "/code/pragma" }),
}));

vi.mock("@/shared/stores/openRepositories", () => ({
  useOpenRepositoriesStore: (selector: (state: { paths: string[] }) => unknown) =>
    selector({ paths: stores.paths }),
}));

vi.mock("./store", () => ({
  useActivityStore: (selector: (state: { entries: typeof stores.entries }) => unknown) =>
    selector({ entries: stores.entries }),
}));

vi.mock("./useShowRepository", () => ({
  useShowRepository: () => async () => {},
}));

vi.mock("./showRepositoryTasks", () => ({
  showRepositoryTasks: () => {},
}));

vi.mock("../tasks/store", () => ({
  repositoryTasks: (byRoot: typeof tasks.byRoot, rootPath: string) =>
    byRoot[rootPath] ?? { tasks: [], loaded: false, loadFailed: false },
  useTasksStore: (selector: (state: { byRoot: typeof tasks.byRoot }) => unknown) =>
    selector({ byRoot: tasks.byRoot }),
}));

import type { DashboardState } from "./dashboard";
import { RepositoryOverview } from "./RepositoryOverview";

function addSessions(rootPath: string, state: DashboardState, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const id = `${rootPath}-${state}-${index}`;
    ai.chatSessions.push({ id, rootPath, title: id, messages: [], createdAt: 0, updatedAt: 0 });
    stores.entries[id] = { state, since: 0 };
  }
}

describe("RepositoryOverview", () => {
  beforeEach(() => {
    ai.chatSessions = [];
    stores.entries = {};
    tasks.byRoot = {};
    stores.paths = ["/code/pragma", "/code/test-repo", "/code/empty"];
  });

  it("shows the working agents of each open repository", () => {
    addSessions("/code/pragma", "working", 2);
    addSessions("/code/test-repo", "working", 4);

    const html = renderToStaticMarkup(<RepositoryOverview variant="full" />);

    expect(html).toContain("pragma");
    expect(html).toContain("2 working");
    expect(html).toContain("4 working");
    expect(html).toContain("No active agents");
  });

  it("marks an inactive repository with a session waiting for approval", () => {
    addSessions("/code/test-repo", "waiting", 1);

    const html = renderToStaticMarkup(<RepositoryOverview variant="compact" />);

    expect(html).toContain("1 waiting");
    expect(html).toContain('aria-label="Needs your input"');
  });

  it("shows the tasks in progress and in review of each repository", () => {
    const board = (statuses: string[]) => ({
      tasks: statuses.map((status, index) => ({ id: `${status}-${index}`, status })),
      loaded: true,
      loadFailed: false,
    });
    tasks.byRoot = {
      "/code/pragma": board(["in_progress", "in_progress", "todo"]),
      "/code/test-repo": board(["in_review", "done"]),
    };

    const html = renderToStaticMarkup(<RepositoryOverview variant="full" />);

    expect(html).toContain("2 tasks in progress");
    expect(html).toContain("1 task in review");
  });

  it("stays hidden with a single open repository", () => {
    stores.paths = ["/code/pragma"];

    expect(renderToStaticMarkup(<RepositoryOverview variant="compact" />)).toBe("");
  });
});
