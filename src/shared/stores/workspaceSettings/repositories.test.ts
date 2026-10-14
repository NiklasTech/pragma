import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { useSettingsStore } from "@/shared/stores/settings";

import { getAgentSettings } from "./effective";
import {
  isRepositoryTrusted,
  repositoryWorkspaceSettings,
  useRepositorySettingsStore,
} from "./repositories";
import { useWorkspaceSettingsStore } from "./store";
import { useFolderTrustStore } from "./trust";

describe("repository settings", () => {
  beforeEach(() => {
    invoke.mockReset();
    useRepositorySettingsStore.setState({ byRoot: {} });
    useWorkspaceSettingsStore.setState({
      rootPath: "/a",
      settings: { agent: { stepLimit: 10, allowedCommands: ["make"] } },
      error: null,
    });
    useFolderTrustStore.setState({ rootPath: "/a", trusted: false });
    const settings = useSettingsStore.getState();
    useSettingsStore.setState({
      agent: { ...settings.agent, allowedCommands: ["ls"], stepLimit: 50 },
    });
  });

  it("loads the settings and trust of a repository", async () => {
    invoke.mockImplementation(async (command: string) =>
      command === "workspace_settings_load"
        ? { agent: { stepLimit: 20, allowedCommands: ["cargo test"] } }
        : { trusted: true },
    );

    await useRepositorySettingsStore.getState().load("/b");

    expect(invoke).toHaveBeenCalledWith("workspace_settings_load", { rootPath: "/b" });
    expect(invoke).toHaveBeenCalledWith("workspace_trust_status", { rootPath: "/b" });
    expect(repositoryWorkspaceSettings("/b")?.agent?.stepLimit).toBe(20);
    expect(isRepositoryTrusted("/b")).toBe(true);
  });

  it("reads the active repository from the live stores", () => {
    useRepositorySettingsStore.setState({
      byRoot: { "/a": { settings: { agent: { stepLimit: 99 } }, trusted: true } },
    });

    expect(repositoryWorkspaceSettings("/a")?.agent?.stepLimit).toBe(10);
    expect(isRepositoryTrusted("/a")).toBe(false);
  });

  it("treats an unknown repository as untrusted without settings", () => {
    expect(repositoryWorkspaceSettings("/unknown")).toBeNull();
    expect(isRepositoryTrusted("/unknown")).toBe(false);
  });

  it("stays untrusted without settings when the reads fail", async () => {
    invoke.mockRejectedValue(new Error("unavailable"));

    await useRepositorySettingsStore.getState().load("/b");

    expect(repositoryWorkspaceSettings("/b")).toBeNull();
    expect(isRepositoryTrusted("/b")).toBe(false);
  });

  it("drops a closed repository", () => {
    useRepositorySettingsStore.setState({
      byRoot: { "/b": { settings: null, trusted: true }, "/c": { settings: null, trusted: true } },
    });

    useRepositorySettingsStore.getState().unload("/b");

    expect(Object.keys(useRepositorySettingsStore.getState().byRoot)).toEqual(["/c"]);
  });

  it("applies the agent settings and trust of the session's repository", () => {
    useRepositorySettingsStore.setState({
      byRoot: {
        "/b": {
          settings: { agent: { stepLimit: 20, allowedCommands: ["cargo test"] } },
          trusted: true,
        },
      },
    });

    expect(getAgentSettings("/b")).toMatchObject({
      stepLimit: 20,
      allowedCommands: ["ls", "cargo test"],
    });
    expect(getAgentSettings("/a")).toMatchObject({ stepLimit: 10, allowedCommands: ["ls"] });
    expect(getAgentSettings()).toMatchObject({ stepLimit: 10, allowedCommands: ["ls"] });
  });
});
