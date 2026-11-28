import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const { PRAGMA_TOOLS } = await import("./useAcpPragmaTools");

/** The tool names the Rust tool groups offer to agents. */
function rustToolNames(): string[] {
  const dir = join(process.cwd(), "src-tauri", "src", "ai", "child_sessions", "tools");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".rs"))
    .flatMap((file) =>
      [...readFileSync(join(dir, file), "utf8").matchAll(/"name": "([a-z_]+)"/g)].map(
        (match) => match[1],
      ),
    );
}

describe("PRAGMA_TOOLS", () => {
  it("answers every built-in tool the MCP server lists, and no other", () => {
    expect(Object.keys(PRAGMA_TOOLS).sort()).toEqual(rustToolNames().sort());
  });
});
