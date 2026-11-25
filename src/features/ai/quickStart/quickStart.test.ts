import { describe, expect, it } from "vite-plus/test";

import type { CLIManifest, CLIStatus } from "@/shared/stores/ai";

import type { PresetNode, PresetPane } from "../panes/layoutPresets";
import {
  agentPane,
  quickAgents,
  QUICK_LAYOUTS,
  taskSlug,
  taskTabTitle,
  TERMINAL_ONLY,
  withAgent,
} from "./quickStart";

const manifest = (id: string, offersTerminal = true): CLIManifest =>
  ({ id, name: id, offers_terminal: offersTerminal }) as CLIManifest;
const status = (installed: boolean): CLIStatus => ({ installed }) as CLIStatus;

const claude: PresetPane = { type: "pane", start: "cli", cliProviderId: "claude" };

describe("quickAgents", () => {
  it("splits terminal CLIs into installed and missing, keeping manifest order", () => {
    const agents = quickAgents(
      [manifest("claude"), manifest("acp-only", false), manifest("codex"), manifest("gemini")],
      { claude: status(true), gemini: status(true), codex: status(false) },
    );
    expect(agents.ready.map((item) => item.id)).toEqual(["claude", "gemini"]);
    expect(agents.missing.map((item) => item.id)).toEqual(["codex"]);
  });
});

describe("layouts", () => {
  it("builds the built-in layouts around the agent pane", () => {
    const [single, shells, pair] = QUICK_LAYOUTS.map((layout) => layout.build(claude));
    expect(single).toEqual(claude);
    expect(shells.type === "split" && shells.children[0]).toEqual(claude);
    expect(pair.type === "split" && pair.children).toEqual([claude, claude]);
    expect(agentPane(TERMINAL_ONLY)).toEqual({ type: "pane", start: "shell" });
  });

  it("puts the agent into the layout as a chat beside the shells", () => {
    const chat = agentPane(
      { kind: "cli", manifestId: "claude", accountDir: "/h/.claude-2" },
      "chat",
    );
    expect(chat).toEqual({ ...claude, cliAccountDir: "/h/.claude-2", view: "chat" });
    const shells = QUICK_LAYOUTS[1].build(chat);
    expect(shells.type === "split" && shells.children[0]).toEqual(chat);
    expect(agentPane({ kind: "cli", manifestId: "claude" }, "terminal")).toEqual(claude);
  });

  it("gives a saved layout's first empty pane to the agent unless it runs a CLI", () => {
    const empty: PresetNode = {
      type: "split",
      direction: "horizontal",
      sizes: [50, 50],
      children: [
        { type: "pane", start: "shell" },
        { type: "pane", start: "empty" },
      ],
    };
    const filled = withAgent(empty, claude);
    expect(filled.type === "split" && filled.children[1]).toEqual(claude);

    const withCli: PresetNode = { ...empty, children: [claude, { type: "pane", start: "empty" }] };
    expect(withAgent(withCli, agentPane(TERMINAL_ONLY))).toBe(withCli);
  });
});

describe("task names", () => {
  it("derives the same slug as the backend", () => {
    expect(taskSlug("Warn before opening files over 5 MB!")).toBe(
      "warn-before-opening-files-over-5-mb",
    );
    expect(taskSlug("  --  ")).toBe("");
    expect(taskSlug("x".repeat(60))).toHaveLength(40);
  });

  it("names the tab after the first words", () => {
    expect(taskTabTitle("Fix the login form")).toBe("Fix the login form");
    expect(taskTabTitle("Warn before opening files over 5 MB")).toBe("Warn before opening files…");
    expect(taskTabTitle("   ", "Claude Code")).toBe("Claude Code");
    expect(taskTabTitle("Fix it", "Claude Code")).toBe("Fix it");
  });
});
