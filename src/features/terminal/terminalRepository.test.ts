import { describe, expect, it } from "vite-plus/test";

import {
  terminalEnvRoot,
  terminalRepository,
  terminalRepositoryChoices,
} from "./terminalRepository";

const paths = ["/code/a", "/code/b"];

describe("terminal repository", () => {
  it("offers the active repository first", () => {
    expect(terminalRepositoryChoices(paths, "/code/b")).toEqual(["/code/b", "/code/a"]);
    expect(terminalRepositoryChoices(paths, null)).toEqual(paths);
    expect(terminalRepositoryChoices([], null)).toEqual([]);
  });

  it("finds the repository a terminal started in", () => {
    expect(terminalRepository({ cwd: "/code/b/src" }, paths)).toBe("/code/b");
    expect(terminalRepository({ cwd: "/tmp" }, paths)).toBeNull();
    expect(terminalRepository({}, paths)).toBeNull();
  });

  it("uses the terminal's own repository for its environment, else the active one", () => {
    expect(terminalEnvRoot({ cwd: "/code/b" }, paths, "/code/a")).toBe("/code/b");
    expect(terminalEnvRoot({ cwd: "/tmp" }, paths, "/code/a")).toBe("/code/a");
  });
});
