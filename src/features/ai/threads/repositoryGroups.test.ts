import { describe, expect, it } from "vite-plus/test";

import { buildThreadSections } from "./categories";
import { groupByRepository } from "./repositoryGroups";

interface Thread {
  id: string;
  rootPath: string;
  updatedAt: number;
  category?: string;
}

const NOW = 1_000_000_000;
const PATHS = ["/code/pragma", "/code/test-repo", "/code/docs"];

function thread(id: string, rootPath: string, category?: string): Thread {
  return { id, rootPath, updatedAt: NOW, category };
}

const bySections = (threads: Thread[]) => buildThreadSections(threads, () => false, NOW);

describe("groupByRepository", () => {
  it("lists every thread under its repository in the order the repositories were opened", () => {
    const threads = [
      thread("d1", "/code/docs"),
      thread("p1", "/code/pragma"),
      thread("t1", "/code/test-repo"),
      thread("p2", "/code/pragma"),
    ];

    const groups = groupByRepository(PATHS, threads, bySections);

    expect(groups.map((group) => group.name)).toEqual(["pragma", "test-repo", "docs"]);
    expect(groups.map((group) => group.count)).toEqual([2, 1, 1]);
    expect(groups[0]?.sections.flatMap((section) => section.items.map((item) => item.id))).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("leaves out repositories without threads and threads of closed repositories", () => {
    const threads = [thread("p1", "/code/pragma"), thread("x1", "/code/closed")];

    const groups = groupByRepository(PATHS, threads, bySections);

    expect(groups.map((group) => group.path)).toEqual(["/code/pragma"]);
  });

  it("keeps categories inside each repository with keys that differ between repositories", () => {
    const threads = [
      thread("p1", "/code/pragma", "Research"),
      thread("p2", "/code/pragma"),
      thread("t1", "/code/test-repo", "Research"),
    ];

    const groups = groupByRepository(PATHS, threads, bySections);
    const [pragma, testRepo] = groups;

    expect(pragma?.sections.map((section) => section.label)).toEqual(["Research", "Today"]);
    expect(testRepo?.sections.map((section) => section.label)).toEqual(["Research"]);
    expect(pragma?.sections[0]?.key).not.toBe(testRepo?.sections[0]?.key);
  });

  it("passes the repository path to the section builder", () => {
    const seen: string[] = [];
    groupByRepository(PATHS, [thread("t1", "/code/test-repo")], (items, path) => {
      seen.push(path);
      return bySections(items);
    });

    expect(seen).toEqual(["/code/test-repo"]);
  });
});
