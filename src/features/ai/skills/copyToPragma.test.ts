import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { copySkillToPragma, withSkillName } from "./copyToPragma";
import { parseSkill } from "./parse";
import type { Skill } from "./types";

const SOURCE = "/ws/.claude/skills/summarize";
const CONTENT = "---\ndescription: Sums up.\nallowed-tools: Read\n---\n\nSee scripts/run.py.\n";

let files: Map<string, string>;
let dirs: Set<string>;

beforeEach(() => {
  files = new Map([
    [`${SOURCE}/SKILL.md`, CONTENT],
    [`${SOURCE}/scripts/run.py`, "print()\n"],
    [`${SOURCE}/logo.png`, "binary"],
  ]);
  dirs = new Set();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => {
    switch (command) {
      case "create_directory":
        if (dirs.has(args.path)) throw `Already exists: ${args.path}`;
        dirs.add(args.path);
        return undefined;
      case "list_directory_recursive":
        return [...files.keys()]
          .filter((path) => path.startsWith(`${args.path}/`))
          .map((path) => ({ path, is_file: true }));
      case "read_text_file":
        if (args.path.endsWith(".png")) throw new Error("Binary file");
        return { content: files.get(args.path) };
      case "write_text_file":
        files.set(args.path, args.content);
        return undefined;
      default:
        throw new Error(`Unexpected command ${command}`);
    }
  });
});

const skill: Skill = {
  id: "summarize",
  path: `${SOURCE}/SKILL.md`,
  name: "summarize",
  description: "Sums up.",
  enabled: false,
  error: null,
  source: "claude",
};

describe("withSkillName", () => {
  it("adds the id as name only when the front matter has none", () => {
    expect(withSkillName(CONTENT, "summarize")).toBe(`---\nname: summarize\n${CONTENT.slice(4)}`);
    const named = "---\nname: Sum\ndescription: x\n---\n";
    expect(withSkillName(named, "summarize")).toBe(named);
    expect(withSkillName("---\r\ndescription: x\r\n---\r\n", "a")).toBe(
      "---\r\nname: a\r\ndescription: x\r\n---\r\n",
    );
  });
});

describe("copySkillToPragma", () => {
  it("writes a valid .pragma/skills/<id>/SKILL.md with the text files next to it", async () => {
    const result = await copySkillToPragma("/ws", skill);
    expect(result).toEqual({ path: "/ws/.pragma/skills/summarize/SKILL.md", skipped: 1 });
    expect(files.get("/ws/.pragma/skills/summarize/scripts/run.py")).toBe("print()\n");
    expect(files.get(`${SOURCE}/SKILL.md`)).toBe(CONTENT);

    const copied = files.get(result.path) ?? "";
    expect(parseSkill("summarize", result.path, copied)).toMatchObject({
      name: "summarize",
      error: null,
    });
  });

  it("refuses when the .pragma skill folder exists", async () => {
    dirs.add("/ws/.pragma/skills/summarize");
    await expect(copySkillToPragma("/ws", skill)).rejects.toThrow(
      "A folder named summarize already exists in .pragma/skills",
    );
  });
});
