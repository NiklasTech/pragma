import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useRunConfigStore, type RunConfig, type RunProcess } from "@/shared/stores/runConfig";
import { runTaskByName } from "./runTasks";

const ROOT = "/work/app";

const config: RunConfig = {
  name: "dev",
  command: "pnpm dev",
  env: {},
  autostart: false,
  autoRestart: false,
};

function process(status: RunProcess["status"], rootPath = ROOT): RunProcess {
  return {
    id: `proc-${status}`,
    rootPath,
    configName: "dev",
    command: "pnpm dev",
    status,
    exitCode: null,
    output: [],
  };
}

describe("runTaskByName", () => {
  const startConfig = vi.fn(async () => undefined);
  const restartProcess = vi.fn(async () => {});

  beforeEach(() => {
    startConfig.mockClear();
    restartProcess.mockClear();
    useRunConfigStore.setState({
      configs: [config],
      processes: [],
      workspaceRoot: ROOT,
      startConfig,
      restartProcess,
    });
  });

  it("starts a configuration that has no process yet", async () => {
    await runTaskByName("dev");
    expect(startConfig).toHaveBeenCalledWith(config);
    expect(restartProcess).not.toHaveBeenCalled();
  });

  it("restarts the stopped process of the active folder", async () => {
    useRunConfigStore.setState({ processes: [process("stopped")] });
    await runTaskByName("dev");
    expect(restartProcess).toHaveBeenCalledWith("proc-stopped");
    expect(startConfig).not.toHaveBeenCalled();
  });

  it("leaves a running task alone", async () => {
    useRunConfigStore.setState({ processes: [process("running")] });
    await runTaskByName("dev");
    expect(startConfig).not.toHaveBeenCalled();
    expect(restartProcess).not.toHaveBeenCalled();
  });

  it("starts a fresh process when only another folder ran it", async () => {
    useRunConfigStore.setState({ processes: [process("stopped", "/work/other")] });
    await runTaskByName("dev");
    expect(startConfig).toHaveBeenCalledWith(config);
  });

  it("ignores names without a configuration", async () => {
    await runTaskByName("missing");
    expect(startConfig).not.toHaveBeenCalled();
  });
});
