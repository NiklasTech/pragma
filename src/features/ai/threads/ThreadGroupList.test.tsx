import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ChatSession } from "@/shared/stores/ai";

import { buildThreadSections } from "./categories";
import { groupByRepository } from "./repositoryGroups";
import { ThreadGroupList } from "./ThreadGroupList";

const PATHS = ["/code/pragma", "/code/test-repo", "/code/docs"];

function session(id: string, rootPath: string): ChatSession {
  return { id, rootPath, title: `Thread ${id}`, messages: [], createdAt: 0, updatedAt: 0 };
}

function render(collapsed: ReadonlySet<string> = new Set()) {
  const sessions = [
    session("p1", "/code/pragma"),
    session("t1", "/code/test-repo"),
    session("d1", "/code/docs"),
  ];
  const groups = groupByRepository(PATHS, sessions, (items) =>
    buildThreadSections(items, () => false),
  );
  return renderToStaticMarkup(
    <ThreadGroupList
      groups={groups}
      byRepository
      activePath="/code/pragma"
      collapsed={collapsed}
      onToggle={() => {}}
      renderThread={(item) => <span key={item.id}>{item.title}</span>}
    />,
  );
}

describe("ThreadGroupList", () => {
  it("lists every thread under its repository", () => {
    const html = render();

    for (const name of ["pragma", "test-repo", "docs"]) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    expect(html.indexOf('aria-label="pragma"')).toBeLessThan(html.indexOf("Thread p1"));
    expect(html.indexOf("Thread p1")).toBeLessThan(html.indexOf('aria-label="test-repo"'));
    expect(html.indexOf('aria-label="test-repo"')).toBeLessThan(html.indexOf("Thread t1"));
    expect(html.indexOf('aria-label="docs"')).toBeLessThan(html.indexOf("Thread d1"));
  });

  it("hides the threads of a collapsed repository", () => {
    const html = render(new Set(["repository:/code/test-repo"]));

    expect(html).toContain('aria-label="test-repo"');
    expect(html).not.toContain("Thread t1");
    expect(html).toContain("Thread p1");
  });
});
