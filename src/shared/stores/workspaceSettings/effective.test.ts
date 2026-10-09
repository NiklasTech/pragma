import { describe, expect, it } from "vite-plus/test";

import type { AgentSettings } from "@/shared/stores/settings";
import { defaultSettings } from "@/shared/stores/settings/defaults";

import { lspEnabledFor, mergeAgentSettings, mergeEditorSettings } from "./effective";
import { resolveTrust, securityKey } from "./trust";

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

  it("asks again when the allowed commands change", () => {
    const settings = { agent: { allowedCommands: ["pnpm test"] } };
    const key = securityKey(settings);
    expect(securityKey({ agent: { stepLimit: 3 } })).toBeNull();
    expect(resolveTrust("/repo", { agent: { stepLimit: 3 } }, {})).toBe("none");
    expect(resolveTrust(null, settings, {})).toBe("none");
    expect(resolveTrust("/repo", settings, {})).toBe("pending");
    expect(resolveTrust("/repo", settings, { "/repo": { key: key ?? "", trusted: true } })).toBe(
      "trusted",
    );
    expect(resolveTrust("/repo", settings, { "/repo": { key: key ?? "", trusted: false } })).toBe(
      "rejected",
    );
    const changed = { agent: { allowedCommands: ["pnpm test", "rm -rf build"] } };
    expect(resolveTrust("/repo", changed, { "/repo": { key: key ?? "", trusted: true } })).toBe(
      "pending",
    );
  });
});
