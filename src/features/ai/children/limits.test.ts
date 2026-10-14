import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import {
  buildSessionTree,
  checkSpawnLimits,
  descendantIds,
  parseSpawnRequest,
  sessionDepth,
  spawnLimits,
} from "./limits";

function session(id: string, init: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    rootPath: "/repo",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    kind: "agent",
    ...init,
  };
}

describe("parseSpawnRequest", () => {
  const parent = session("p");

  it("defaults a writing parent's child to a worktree conversation", () => {
    const parsed = parseSpawnRequest({ title: " Fix tests ", prompt: "Run them" }, parent);
    expect(parsed).toEqual({
      ok: true,
      request: {
        title: "Fix tests",
        prompt: "Run them",
        kind: "conversation",
        environment: "worktree",
        cli: null,
      },
    });
  });

  it("defaults to the checkout when the parent does not write", () => {
    const parsed = parseSpawnRequest({ title: "a", prompt: "b" }, session("p", { kind: "ask" }));
    expect(parsed.ok && parsed.request.environment).toBe("checkout");
  });

  it("accepts parent as environment and follows the project setting by default", () => {
    const explicit = parseSpawnRequest({ title: "a", prompt: "b", environment: "parent" }, parent);
    expect(explicit.ok && explicit.request.environment).toBe("parent");
    const fromSetting = parseSpawnRequest({ title: "a", prompt: "b" }, parent, "parent");
    expect(fromSetting.ok && fromSetting.request.environment).toBe("parent");
    const overridden = parseSpawnRequest(
      { title: "a", prompt: "b", environment: "worktree" },
      parent,
      "parent",
    );
    expect(overridden.ok && overridden.request.environment).toBe("worktree");
  });

  it("keeps a reading parent's child in the checkout regardless of the setting", () => {
    const parsed = parseSpawnRequest(
      { title: "a", prompt: "b" },
      session("p", { kind: "ask" }),
      "parent",
    );
    expect(parsed.ok && parsed.request.environment).toBe("checkout");
  });

  it("rejects titles outside 1 to 80 characters", () => {
    expect(parseSpawnRequest({ title: " ", prompt: "b" }, parent).ok).toBe(false);
    expect(parseSpawnRequest({ title: "x".repeat(81), prompt: "b" }, parent).ok).toBe(false);
    expect(parseSpawnRequest({ title: "x".repeat(80), prompt: "b" }, parent).ok).toBe(true);
  });

  it("requires a prompt, a known kind and a known environment", () => {
    expect(parseSpawnRequest({ title: "a" }, parent).ok).toBe(false);
    expect(parseSpawnRequest({ title: "a", prompt: "b", kind: "hidden" }, parent).ok).toBe(false);
    expect(parseSpawnRequest({ title: "a", prompt: "b", environment: "cloud" }, parent).ok).toBe(
      false,
    );
  });

  it("requires a CLI id for a terminal child", () => {
    expect(parseSpawnRequest({ title: "a", prompt: "b", kind: "terminal" }, parent)).toEqual({
      ok: false,
      error: "A terminal session needs the id of a detected CLI",
    });
    const parsed = parseSpawnRequest(
      { title: "a", prompt: "b", kind: "terminal", cli: "openai-codex" },
      parent,
    );
    expect(parsed.ok && parsed.request.cli).toBe("openai-codex");
  });
});

describe("checkSpawnLimits", () => {
  it("allows a third level and rejects a fourth", () => {
    const sessions = [
      session("a"),
      session("b", { parentId: "a" }),
      session("c", { parentId: "b" }),
    ];
    expect(sessionDepth(sessions, "c")).toBe(3);
    expect(checkSpawnLimits(sessions, "b")).toBeNull();
    expect(checkSpawnLimits(sessions, "c")).toBe(
      "Session nesting is limited to 3 levels. Change the limit in Settings > Agents > Child sessions.",
    );
  });

  it("rejects a fifth child and ignores archived ones", () => {
    const children = ["1", "2", "3", "4"].map((id) => session(id, { parentId: "p" }));
    expect(checkSpawnLimits([session("p"), ...children], "p")).toBe(
      "This session already has the maximum of 4 children. Change the limit in Settings > Agents > Child sessions.",
    );
    const archived = { ...children[0], archived: true };
    expect(checkSpawnLimits([session("p"), archived, ...children.slice(1)], "p")).toBeNull();
  });

  it("allows seven children with a raised limit and refuses the eighth", () => {
    const limits = spawnLimits({ maxChildSessions: 7, maxSessionDepth: 3 });
    const children = ["1", "2", "3", "4", "5", "6"].map((id) => session(id, { parentId: "p" }));
    expect(checkSpawnLimits([session("p"), ...children], "p", limits)).toBeNull();
    const seven = [...children, session("7", { parentId: "p" })];
    expect(checkSpawnLimits([session("p"), ...seven], "p", limits)).toContain("maximum of 7");
  });

  it("applies a lower depth limit", () => {
    const sessions = [session("a"), session("b", { parentId: "a" })];
    const limits = spawnLimits({ maxChildSessions: 4, maxSessionDepth: 2 });
    expect(checkSpawnLimits(sessions, "a", limits)).toBeNull();
    expect(checkSpawnLimits(sessions, "b", limits)).toContain("limited to 2 levels");
  });

  it("stops counting depth on a parent cycle", () => {
    const sessions = [session("a", { parentId: "b" }), session("b", { parentId: "a" })];
    expect(sessionDepth(sessions, "a")).toBe(2);
  });
});

describe("spawnLimits", () => {
  it("clamps the settings to their bounds", () => {
    expect(spawnLimits({ maxChildSessions: 50, maxSessionDepth: 9 })).toEqual({
      maxChildren: 8,
      maxDepth: 3,
    });
    expect(spawnLimits({ maxChildSessions: 0, maxSessionDepth: 1 })).toEqual({
      maxChildren: 1,
      maxDepth: 2,
    });
    expect(spawnLimits({ maxChildSessions: 2.5, maxSessionDepth: Number.NaN })).toEqual({
      maxChildren: 4,
      maxDepth: 3,
    });
  });
});

describe("descendantIds", () => {
  it("collects children and grandchildren", () => {
    const sessions = [
      session("a"),
      session("b", { parentId: "a" }),
      session("c", { parentId: "b" }),
      session("d"),
    ];
    expect(descendantIds(sessions, "a")).toEqual(["b", "c"]);
  });
});

describe("buildSessionTree", () => {
  it("nests children under a listed parent and keeps orphans as roots", () => {
    const sessions = [
      session("a"),
      session("b", { parentId: "a" }),
      session("c", { parentId: "gone" }),
    ];
    const tree = buildSessionTree(sessions);
    expect(tree.roots.map((item) => item.id)).toEqual(["a", "c"]);
    expect(tree.childrenOf.get("a")?.map((item) => item.id)).toEqual(["b"]);
  });
});
