import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { readSkillFile } from "./readSkillFile";
import { useSkillsStore } from "./store";

const DIR = "/ws/.pragma/skills";

function readOnly(existing: Record<string, string>) {
  invokeMock.mockImplementation(async (_command: string, args: { path: string }) => {
    const content = existing[args.path];
    if (content === undefined) throw new Error(`Not found: ${args.path}`);
    return { content };
  });
}

describe("readSkillFile", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useSkillsStore.setState({ rootPath: null, skills: [] });
  });

  it("reads the path of a loaded skill", async () => {
    useSkillsStore.setState({
      rootPath: "/ws",
      skills: [
        {
          id: "pdf",
          path: `${DIR}/pdf.md`,
          name: "pdf",
          description: "",
          enabled: true,
          error: "Duplicate skill id",
        },
        {
          id: "pdf",
          path: `${DIR}/pdf/SKILL.md`,
          name: "pdf",
          description: "Read PDFs.",
          enabled: true,
          error: null,
        },
      ],
    });
    readOnly({ [`${DIR}/pdf.md`]: "old", [`${DIR}/pdf/SKILL.md`]: "new" });

    expect(await readSkillFile("/ws", "pdf")).toEqual({
      path: `${DIR}/pdf/SKILL.md`,
      content: "new",
    });
  });

  it("tries the single file, then the folder, for an unknown id", async () => {
    readOnly({ [`${DIR}/pdf/SKILL.md`]: "folder" });
    expect(await readSkillFile("/ws", "pdf")).toEqual({
      path: `${DIR}/pdf/SKILL.md`,
      content: "folder",
    });

    readOnly({});
    await expect(readSkillFile("/ws", "pdf")).rejects.toThrow("Not found");
  });
});
