import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { convertSkillFile, createSkillFile, loadWorkspaceSkills } from "./storage";

const DIR = "/ws/.pragma/skills";
const LEGACY =
  "---\nname: Release\ndescription: Ship it.\n---\n\n## Steps\n\n## Check\n\n## Needs approval\n";
const STANDARD = "---\nname: pdf\ndescription: Read PDFs.\n---\n\nFree text.\n";

let files: Map<string, string>;
let dirs: Set<string>;

function parent(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function listDirectory(path: string) {
  if (!dirs.has(path)) throw new Error(`Not found: ${path}`);
  const children = [...dirs, ...files.keys()].filter((child) => parent(child) === path);
  return children.map((child) => ({
    path: child,
    name: child.slice(path.length + 1),
    is_directory: dirs.has(child),
    is_file: files.has(child),
  }));
}

function fakeInvoke(command: string, args: Record<string, string>) {
  switch (command) {
    case "list_directory":
      return listDirectory(args.path);
    case "read_text_file": {
      const content = files.get(args.path);
      if (content === undefined) throw new Error(`Not found: ${args.path}`);
      return { path: args.path, name: "", content };
    }
    case "create_directory":
      if (dirs.has(args.path) || files.has(args.path)) throw `Already exists: ${args.path}`;
      dirs.add(args.path);
      return undefined;
    case "create_file":
      if (files.has(args.path)) throw `Already exists: ${args.path}`;
      files.set(args.path, "");
      return undefined;
    case "write_text_file":
      files.set(args.path, args.content);
      return undefined;
    case "rename_file": {
      const content = files.get(args.oldPath);
      if (content === undefined) throw `Source not found: ${args.oldPath}`;
      files.delete(args.oldPath);
      files.set(args.newPath, content);
      return undefined;
    }
    case "delete_file":
      dirs.delete(args.path);
      return undefined;
    default:
      throw new Error(`Unexpected command ${command}`);
  }
}

beforeEach(() => {
  files = new Map();
  dirs = new Set([DIR]);
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args: Record<string, string>) =>
    fakeInvoke(command, args),
  );
});

describe("loadWorkspaceSkills", () => {
  it("reads single-file skills and SKILL.md folders", async () => {
    files.set(`${DIR}/release.md`, LEGACY);
    dirs.add(`${DIR}/pdf`);
    files.set(`${DIR}/pdf/SKILL.md`, STANDARD);
    files.set(`${DIR}/pdf/extract.py`, "print()");
    dirs.add(`${DIR}/assets`);

    const skills = await loadWorkspaceSkills("/ws");
    expect(skills.map(({ id, path, error }) => ({ id, path, error }))).toEqual([
      { id: "pdf", path: `${DIR}/pdf/SKILL.md`, error: null },
      { id: "release", path: `${DIR}/release.md`, error: null },
    ]);
  });

  it("lets the folder win when both layouts use the same id", async () => {
    files.set(`${DIR}/pdf.md`, LEGACY);
    dirs.add(`${DIR}/pdf`);
    files.set(`${DIR}/pdf/SKILL.md`, STANDARD);

    const skills = await loadWorkspaceSkills("/ws");
    expect(skills.find((skill) => skill.path === `${DIR}/pdf/SKILL.md`)?.error).toBeNull();
    expect(skills.find((skill) => skill.path === `${DIR}/pdf.md`)?.error).toBe(
      "Duplicate skill id",
    );
  });

  it("returns nothing without a skills folder", async () => {
    dirs.clear();
    expect(await loadWorkspaceSkills("/ws")).toEqual([]);
  });
});

describe("createSkillFile", () => {
  it("creates a SKILL.md folder and skips ids that a single file uses", async () => {
    files.set(`${DIR}/new-skill.md`, LEGACY);

    const path = await createSkillFile("/ws");
    expect(path).toBe(`${DIR}/new-skill-2/SKILL.md`);
    expect(files.get(path)).toContain("name: new-skill-2\n");

    const skills = await loadWorkspaceSkills("/ws");
    expect(skills.find((skill) => skill.path === path)?.error).toBeNull();
  });
});

describe("convertSkillFile", () => {
  it("moves the file into a folder without changing it", async () => {
    files.set(`${DIR}/release.md`, LEGACY);
    const [skill] = await loadWorkspaceSkills("/ws");

    const path = await convertSkillFile(skill);
    expect(path).toBe(`${DIR}/release/SKILL.md`);
    expect(files.get(path)).toBe(LEGACY);
    expect(files.has(`${DIR}/release.md`)).toBe(false);

    const [converted] = await loadWorkspaceSkills("/ws");
    expect(converted).toMatchObject({ id: "release", path, error: null });
  });

  it("refuses when a folder with the id exists", async () => {
    files.set(`${DIR}/release.md`, LEGACY);
    const [skill] = await loadWorkspaceSkills("/ws");
    dirs.add(`${DIR}/release`);

    await expect(convertSkillFile(skill)).rejects.toThrow(
      "A folder named release already exists in .pragma/skills",
    );
    expect(files.get(`${DIR}/release.md`)).toBe(LEGACY);
  });

  it("removes the new folder when the move fails", async () => {
    files.set(`${DIR}/release.md`, LEGACY);
    const [skill] = await loadWorkspaceSkills("/ws");
    files.delete(`${DIR}/release.md`);

    await expect(convertSkillFile(skill)).rejects.toMatch(/Source not found/);
    expect(dirs.has(`${DIR}/release`)).toBe(false);
  });
});
