import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/shell/layout/store", () => ({ useLayoutStore: {} }));

import { drawersToClose } from "./useOneDrawer";

const none = { agents: false, sidebar: false, threads: false };

describe("drawersToClose", () => {
  it("closes the open drawer when another one opens", () => {
    const agents = { ...none, agents: true };
    expect(drawersToClose(agents, { ...agents, sidebar: true })).toEqual(["agents"]);
    const sidebar = { ...none, sidebar: true };
    expect(drawersToClose(sidebar, { ...sidebar, agents: true })).toEqual(["sidebar"]);
  });

  it("closes nothing when one opens alone, stays open or closes", () => {
    const agents = { ...none, agents: true };
    expect(drawersToClose(none, agents)).toEqual([]);
    expect(drawersToClose(agents, agents)).toEqual([]);
    expect(drawersToClose(agents, none)).toEqual([]);
  });
});
