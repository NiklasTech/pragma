import { describe, expect, it } from "vite-plus/test";

import { otherRepositoryProcesses, processLabel, repositoryProcesses } from "./runProcesses";

const processes = [
  { id: "1", rootPath: "/code/a", configName: "dev", status: "running" as const },
  { id: "2", rootPath: "/code/b", configName: "dev", status: "running" as const },
  { id: "3", rootPath: "/code/b", configName: "test", status: "stopped" as const },
];

describe("run processes per repository", () => {
  it("keeps processes of the active repository apart from the others", () => {
    expect(repositoryProcesses(processes, "/code/a").map((process) => process.id)).toEqual(["1"]);
    expect(otherRepositoryProcesses(processes, "/code/a").map((process) => process.id)).toEqual([
      "2",
    ]);
  });

  it("names the repository of a process outside the active one", () => {
    expect(processLabel(processes[0], "/code/a")).toBe("dev");
    expect(processLabel(processes[1], "/code/a")).toBe("dev (b)");
  });
});
