import { describe, expect, it } from "vite-plus/test";

import { importableMarkdownPaths, markdownToTask } from "./markdownImport";

describe("Markdown import", () => {
  it("turns three files into three Todo tasks", () => {
    const tasks = [
      { path: "plans/login.md", content: "# Fix login\n\nUse the new token flow.\n" },
      { path: "docs/Refactor.MD", content: "Split the store into slices." },
      { path: "agent.md", content: "Intro\n\n## Setup\n\n# Ship release\n- Tag\n- Push\n" },
    ].map((file) => markdownToTask(file, 5));

    expect(tasks.map(({ title, notes, status }) => ({ title, notes, status }))).toEqual([
      { title: "Fix login", notes: "Use the new token flow.", status: "todo" },
      { title: "Refactor", notes: "Split the store into slices.", status: "todo" },
      { title: "Ship release", notes: "- Tag\n- Push", status: "todo" },
    ]);
    expect(tasks[0]).toMatchObject({ sourcePath: "plans/login.md", result: "", createdAt: 5 });
  });

  it("ignores headings inside code fences and strips closing hashes", () => {
    const fenced = markdownToTask({ path: "run.md", content: "```sh\n# not a title\n```\n" }, 1);
    expect(fenced.title).toBe("run");
    expect(fenced.notes).toBe("```sh\n# not a title\n```");

    expect(markdownToTask({ path: "a.md", content: "# Deploy ##\nnow" }, 1).title).toBe("Deploy");
  });

  it("keeps titles and notes within the task limits", () => {
    const task = markdownToTask(
      { path: "long.md", content: `# ${"x".repeat(200)}\n${"y".repeat(7999)}\u{1F600}` },
      1,
    );
    expect(task.title.length).toBe(120);
    expect(task.notes).toBe("y".repeat(7999));
  });

  it("applies valid front matter and leaves it out of the notes", () => {
    const task = markdownToTask(
      {
        path: "task.md",
        content: "---\nlabels: [bug, Bug, ui]\npriority: high\nowner: me\n---\n# Crash\nSteps\n",
      },
      1,
    );
    expect(task).toMatchObject({
      title: "Crash",
      notes: "Steps",
      labels: ["bug", "ui"],
      priority: "high",
    });

    const invalid = markdownToTask(
      { path: "b.md", content: `---\nlabels: ${"z".repeat(40)}\npriority: urgent\n---\nBody` },
      1,
    );
    expect(invalid.labels).toBeUndefined();
    expect(invalid.priority).toBeUndefined();
    expect(invalid.notes).toBe("Body");

    const broken = markdownToTask({ path: "c.md", content: "---\nlabels: [\n---\n# Title" }, 1);
    expect(broken).toMatchObject({ title: "Title", notes: "" });
  });

  it("offers only Markdown files that no task links to", () => {
    const linked = markdownToTask({ path: "a.md", content: "# A" }, 1);
    expect(importableMarkdownPaths(["a.md", "b.md", "c.txt"], [linked])).toEqual(["b.md"]);
  });
});
