import { describe, expect, it } from "vite-plus/test";

import { AGENT_TOOL_NAMES } from "@/features/agent/tools";

import {
  checkAgentToolPath,
  isPathApproved,
  isPathInside,
  normalizePath,
  resolveAgentPath,
} from "./folders";

const ROOT = "/workspace";
const APPROVED = "/data/shared";

describe("agent path normalization", () => {
  it("resolves relative paths against the session cwd", () => {
    expect(resolveAgentPath(ROOT, "src/index.ts")).toBe("/workspace/src/index.ts");
    expect(resolveAgentPath(ROOT, "/etc/passwd")).toBe("/etc/passwd");
  });

  it("collapses parent traversal", () => {
    expect(normalizePath("/workspace/../outside")).toBe("/outside");
    expect(normalizePath("C:\\work\\..\\secret")).toBe("C:/secret");
  });

  it("treats the root itself as inside", () => {
    expect(isPathInside(ROOT, ROOT)).toBe(true);
    expect(isPathInside(ROOT, `${ROOT}/src/a.ts`)).toBe(true);
    expect(isPathInside(ROOT, "/workspace-evil/a.ts")).toBe(false);
  });
});

describe("agent folder approval", () => {
  it("allows paths inside the session cwd", () => {
    expect(isPathApproved("/workspace/src/a.ts", [ROOT, APPROVED])).toBe(true);
  });

  it("allows paths inside an approved folder", () => {
    expect(isPathApproved("/data/shared/report.md", [ROOT, APPROVED])).toBe(true);
  });

  it("denies paths outside every allowed root", () => {
    expect(isPathApproved("/etc/passwd", [ROOT, APPROVED])).toBe(false);
    expect(isPathApproved("/data/other/file.md", [ROOT, APPROVED])).toBe(false);
  });
});

describe("agent tool path gate", () => {
  it("approves a file tool inside the session cwd", () => {
    const check = checkAgentToolPath(AGENT_TOOL_NAMES.readFile, { path: "src/a.ts" }, ROOT, []);
    expect(check.approved).toBe(true);
    expect(check.resolvedPath).toBe("/workspace/src/a.ts");
  });

  it("denies a file tool outside the cwd and approved folders", () => {
    const check = checkAgentToolPath(AGENT_TOOL_NAMES.readFile, { path: "/etc/passwd" }, ROOT, [
      APPROVED,
    ]);
    expect(check.approved).toBe(false);
  });

  it("approves a file tool inside an approved folder", () => {
    const check = checkAgentToolPath(
      AGENT_TOOL_NAMES.readFile,
      { path: `${APPROVED}/report.md` },
      ROOT,
      [APPROVED],
    );
    expect(check.approved).toBe(true);
  });

  it("denies parent traversal out of the cwd", () => {
    const check = checkAgentToolPath(
      AGENT_TOOL_NAMES.writeFile,
      { path: "../outside.txt" },
      ROOT,
      [],
    );
    expect(check.approved).toBe(false);
  });

  it("checks the command cwd", () => {
    const outside = checkAgentToolPath(
      AGENT_TOOL_NAMES.runCommand,
      { command: "ls", cwd: "/tmp" },
      ROOT,
      [APPROVED],
    );
    expect(outside.approved).toBe(false);

    const approved = checkAgentToolPath(
      AGENT_TOOL_NAMES.runCommand,
      { command: "ls", cwd: APPROVED },
      ROOT,
      [APPROVED],
    );
    expect(approved.approved).toBe(true);

    const fallback = checkAgentToolPath(AGENT_TOOL_NAMES.runCommand, { command: "ls" }, ROOT, [
      APPROVED,
    ]);
    expect(fallback.approved).toBe(true);
  });
});
