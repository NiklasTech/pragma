import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import { buildLayout, captureLayout, presetPaneCount } from "./layoutPresets";
import { createLeaf, createSplit, createTabs } from "./operations";

const session = (id: string, kind: ChatSession["kind"], cliProviderId?: string) =>
  ({
    id,
    kind,
    cliProviderId,
    rootPath: "/w",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
  }) as ChatSession;

const SESSIONS = [
  session("claude", "terminal", "anthropic-claude"),
  session("shell", "terminal", "shell"),
  session("chat", "agent"),
];

const group = (id: string, sessionId: string | null) =>
  createTabs([createLeaf(sessionId, id)], id, `group-${id}`);

describe("layout presets", () => {
  it("keeps the shape and what each pane starts, not the conversations", () => {
    const col = createSplit("vertical", [group("b", "shell"), group("c", "chat")], [60, 40]);
    const root = createSplit("horizontal", [group("a", "claude"), col], [55, 45]);

    expect(captureLayout(root, SESSIONS)).toEqual({
      type: "split",
      direction: "horizontal",
      sizes: [55, 45],
      children: [
        { type: "pane", start: "cli", cliProviderId: "anthropic-claude" },
        {
          type: "split",
          direction: "vertical",
          sizes: [60, 40],
          children: [
            { type: "pane", start: "shell" },
            { type: "pane", start: "empty" },
          ],
        },
      ],
    });
  });

  it("keeps a coding CLI's chat as a chat with its account", () => {
    const sessions: ChatSession[] = [
      { ...session("acp", "agent", "anthropic-claude"), cliAccountDir: "/h/.claude-2" },
      {
        ...session("pinned", "agent"),
        agentEngine: { kind: "cli", cliProviderId: "xai-grok" },
      },
      session("shell", "terminal", "shell"),
    ];
    const root = createSplit("horizontal", [
      group("a", "acp"),
      group("b", "pinned"),
      group("c", "shell"),
    ]);
    const layout = captureLayout(root, sessions);
    expect(layout?.type === "split" && layout.children).toEqual([
      {
        type: "pane",
        start: "cli",
        cliProviderId: "anthropic-claude",
        cliAccountDir: "/h/.claude-2",
        view: "chat",
      },
      { type: "pane", start: "cli", cliProviderId: "xai-grok", view: "chat" },
      { type: "pane", start: "shell" },
    ]);
  });

  it("builds empty panes in the saved shape with their starts", () => {
    const root = createSplit("horizontal", [group("a", "claude"), group("b", "shell")]);
    const layout = captureLayout(root, SESSIONS);
    if (!layout) throw new Error("no layout");
    const built = buildLayout(layout);

    expect(presetPaneCount(layout)).toBe(2);
    expect(built.root.type === "split" && built.root.children).toHaveLength(2);
    expect(built.starts.map((start) => start.pane.start)).toEqual(["cli", "shell"]);
  });
});
