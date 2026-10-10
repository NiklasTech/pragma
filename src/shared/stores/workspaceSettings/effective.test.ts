import { describe, expect, it } from "vite-plus/test";

import type { AgentSettings } from "@/shared/stores/settings";
import { defaultSettings } from "@/shared/stores/settings/defaults";

import { lspEnabledFor, mergeAgentSettings, mergeEditorSettings } from "./effective";

const agent: AgentSettings = {
  enabled: true,
  autoApprove: "never",
  allowedCommands: ["git status"],
  useProjectRules: true,
  stepLimit: null,
};

describe("workspace settings overlay", () => {
  it("lets workspace editor values win", () => {
    const user = { ...defaultSettings.editor, tabSize: 4, insertSpaces: true, rulers: [100] };
    const merged = mergeEditorSettings(user, { editor: { tabSize: 2, rulers: [80] } });
    expect(merged.tabSize).toBe(2);
    expect(merged.rulers).toEqual([80]);
    expect(merged.insertSpaces).toBe(true);
    expect(mergeEditorSettings(user, null)).toEqual(user);
  });

  it("adds workspace commands only when trusted", () => {
    const workspace = { agent: { allowedCommands: ["pnpm test", "git status"], stepLimit: 30 } };
    expect(mergeAgentSettings(agent, workspace, false).allowedCommands).toEqual(["git status"]);
    const trusted = mergeAgentSettings(agent, workspace, true);
    expect(trusted.allowedCommands).toEqual(["git status", "pnpm test"]);
    expect(trusted.stepLimit).toBe(30);
    expect(mergeAgentSettings(agent, null, true)).toEqual(agent);
  });

  it("resolves language server state from workspace, then user, then on", () => {
    const workspace = { lsp: { enabled: { rust: false } } };
    expect(lspEnabledFor({ rust: true }, workspace, "rust")).toBe(false);
    expect(lspEnabledFor({ go: false }, workspace, "go")).toBe(false);
    expect(lspEnabledFor({}, workspace, "python")).toBe(true);
  });
});
