import { describe, expect, it } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";
import type { ProjectRules } from "@/features/agent/rules";
import { formatSkillCatalog, selectCatalogSkills } from "@/features/ai/skills/catalog";
import type { Skill } from "@/features/ai/skills/types";

import { buildCliLeadingMessage, nativeRulesFiles } from "./cliLeadingMessage";

function skill(id: string, enabled: boolean): Skill {
  return {
    id,
    path: `.pragma/skills/${id}.md`,
    name: id,
    description: `${id} skill`,
    enabled,
    error: null,
  };
}

function rules(path: string): ProjectRules {
  return { path, source: `rules from ${path}`, truncated: false };
}

function manifest(id: string, files: string[]): CLIManifest {
  return {
    id,
    name: id,
    description: "",
    install_cmd: "",
    command: id,
    supports_sessions: true,
    uses_acp: true,
    offers_terminal: true,
    native_rules_files: files,
  };
}

const skills = [skill("review", true), skill("deploy", false)];
const workspaceCatalog = formatSkillCatalog(selectCatalogSkills(skills, null));
const agentCatalog = formatSkillCatalog(selectCatalogSkills(skills, ["deploy"]));

describe("buildCliLeadingMessage", () => {
  it("lists the enabled workspace skills without a named agent", () => {
    const message = buildCliLeadingMessage(null, null, workspaceCatalog, ["CLAUDE.md"]);
    expect(message).toContain("- review: review skill");
    expect(message).not.toContain("deploy");
  });

  it("leaves out a rules file the CLI loads natively", () => {
    const message = buildCliLeadingMessage(null, rules("AGENTS.md"), workspaceCatalog, [
      "AGENTS.md",
    ]);
    expect(message).not.toContain("AGENTS.md");
    expect(message).toContain("- review: review skill");
  });

  it("sends a rules file the CLI does not load natively", () => {
    const message = buildCliLeadingMessage(null, rules("PRAGMA.md"), null, ["AGENTS.md"]);
    expect(message).toContain("--- PRAGMA.md ---");
    expect(message).toContain("rules from PRAGMA.md");
  });

  it("keeps the brief, memory and the agent's own skills with a named agent", () => {
    const agentBlock = "Brief:\nShip it\n\nMemory:\n- prefers pnpm";
    const message = buildCliLeadingMessage(agentBlock, rules("AGENTS.md"), agentCatalog, [
      "AGENTS.md",
    ]);
    expect(message).toContain("Brief:\nShip it");
    expect(message).toContain("- prefers pnpm");
    expect(message).toContain("- deploy: deploy skill");
    expect(message).not.toContain("review");
    expect(message).not.toContain("AGENTS.md");
  });

  it("sends a non-native rules file alongside a named agent", () => {
    const message = buildCliLeadingMessage("Brief:\nShip it", rules("CLAUDE.md"), null, [
      "AGENTS.md",
    ]);
    expect(message).toContain("Brief:\nShip it");
    expect(message).toContain("--- CLAUDE.md ---");
  });

  it("returns null when there is nothing to send", () => {
    expect(buildCliLeadingMessage(null, rules("AGENTS.md"), null, ["AGENTS.md"])).toBeNull();
  });
});

describe("nativeRulesFiles", () => {
  const manifests = [manifest("openai-codex", ["AGENTS.md"])];

  it("reads the rules files of the active CLI from its manifest", () => {
    expect(nativeRulesFiles(manifests, "openai-codex")).toEqual(["AGENTS.md"]);
  });

  it("is empty for the built-in engine or an unknown CLI", () => {
    expect(nativeRulesFiles(manifests, null)).toEqual([]);
    expect(nativeRulesFiles(manifests, "unknown")).toEqual([]);
  });
});
