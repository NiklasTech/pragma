import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());
const stored = vi.hoisted(() => new Map<string, string>());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.stubGlobal("localStorage", {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
});

import { cliSkillKey, writeEnabledCliSkill } from "./cliEnabled";
import { loadCliSkills } from "./cliStorage";

const SKILL = (name: string) => `---\nname: ${name}\ndescription: Does ${name}.\n---\n\nBody.\n`;

let files: Map<string, string>;

function listDirectory(path: string) {
  const children = new Map<string, boolean>();
  for (const file of files.keys()) {
    if (!file.startsWith(`${path}/`)) continue;
    const [name, ...rest] = file.slice(path.length + 1).split("/");
    children.set(name, rest.length > 0);
  }
  if (children.size === 0) throw new Error(`Not found: ${path}`);
  return [...children].map(([name, isDirectory]) => ({
    path: `${path}/${name}`,
    name,
    is_directory: isDirectory,
    is_file: !isDirectory,
  }));
}

beforeEach(() => {
  files = new Map();
  stored.clear();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args: { path: string }) => {
    if (command === "list_directory") return listDirectory(args.path);
    if (command === "read_text_file") {
      const content = files.get(args.path);
      if (content === undefined) throw new Error(`Not found: ${args.path}`);
      return { content };
    }
    throw new Error(`Unexpected command ${command}`);
  });
});

describe("loadCliSkills", () => {
  it("lists skills from .claude and .agents with their source, disabled by default", async () => {
    files.set("/ws/.claude/skills/x/SKILL.md", SKILL("x"));
    files.set("/ws/.agents/skills/y/SKILL.md", SKILL("y"));

    const skills = await loadCliSkills("/ws", new Set());
    expect(
      skills.map(({ id, source, enabled, error }) => ({ id, source, enabled, error })),
    ).toEqual([
      { id: "y", source: "agents", enabled: false, error: null },
      { id: "x", source: "claude", enabled: false, error: null },
    ]);
  });

  it("keeps the enabled state on this machine", async () => {
    files.set("/ws/.claude/skills/x/SKILL.md", SKILL("x"));
    writeEnabledCliSkill("/ws", cliSkillKey("claude", "x"), true);

    const [skill] = await loadCliSkills("/ws", new Set());
    expect(skill.enabled).toBe(true);
    expect(await loadCliSkills("/other", new Set())).toEqual([]);
  });

  it("leaves out ids that .pragma or an earlier folder already uses", async () => {
    files.set("/ws/.agents/skills/shared/SKILL.md", SKILL("shared"));
    files.set("/ws/.claude/skills/shared/SKILL.md", SKILL("shared"));
    files.set("/ws/.claude/skills/release/SKILL.md", SKILL("release"));

    const skills = await loadCliSkills("/ws", new Set(["release"]));
    expect(skills.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: "shared", source: "agents" },
    ]);
  });

  it("uses the folder name when the name is missing and lists malformed files with an error", async () => {
    files.set(
      "/ws/.claude/skills/summarize/SKILL.md",
      "---\ndescription: Sums up.\n---\n\nBody.\n",
    );
    files.set("/ws/.claude/skills/broken/SKILL.md", "No front matter.\n");
    files.set("/ws/.claude/skills/bad yaml/SKILL.md", SKILL("bad"));

    const skills = await loadCliSkills("/ws", new Set());
    const byId = new Map(skills.map((skill) => [skill.id, skill]));
    expect(byId.get("summarize")).toMatchObject({ name: "summarize", error: null });
    expect(byId.get("broken")?.error).toBe("Missing front matter");
    expect(byId.get("bad yaml")?.error).toMatch(/Folder name/);
  });
});
