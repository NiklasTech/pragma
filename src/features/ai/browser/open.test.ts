import { beforeEach, describe, expect, it } from "vite-plus/test";

import { countLeaves, findBrowserLeaf, MAX_PANES } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";
import { currentUrl, useBrowserHistoryStore } from "./history";
import { openBrowserPane, openUrlInBrowser } from "./open";

const ROOT = "/workspace";

function root() {
  return useAgentsPanesStore.getState().trees[ROOT]?.root ?? null;
}

function urlOf(leafId: string): string | null {
  return currentUrl(useBrowserHistoryStore.getState().byLeaf[leafId]);
}

describe("browser pane opening", () => {
  beforeEach(() => {
    useAgentsPanesStore.setState({ trees: {} });
    useBrowserHistoryStore.setState({ byLeaf: {} });
  });

  it("splits the focused pane and opens the URL there", () => {
    useAgentsPanesStore.getState().openSession(ROOT, "a");
    const focusedBefore = useAgentsPanesStore.getState().trees[ROOT].focusedLeafId;

    expect(openUrlInBrowser(ROOT, "http://localhost:5173/", false)).toBe("opened");

    const browser = findBrowserLeaf(root());
    expect(browser).not.toBeNull();
    expect(countLeaves(root())).toBe(2);
    expect(urlOf(browser!.id)).toBe("http://localhost:5173/");
    expect(useAgentsPanesStore.getState().trees[ROOT].focusedLeafId).toBe(focusedBefore);
  });

  it("navigates and focuses the open browser pane", () => {
    useAgentsPanesStore.getState().openSession(ROOT, "a");
    openUrlInBrowser(ROOT, "http://localhost:3000/", false);

    expect(openUrlInBrowser(ROOT, "http://localhost:4000/", true)).toBe("navigated");

    const browser = findBrowserLeaf(root())!;
    expect(countLeaves(root())).toBe(2);
    expect(urlOf(browser.id)).toBe("http://localhost:4000/");
    expect(useAgentsPanesStore.getState().trees[ROOT].focusedLeafId).toBe(browser.id);
  });

  it("counts toward the pane cap", () => {
    for (let index = 0; index < MAX_PANES; index += 1) {
      useAgentsPanesStore.getState().openSession(ROOT, `s${index}`);
    }

    expect(openUrlInBrowser(ROOT, "http://localhost:5173/", true)).toBe("full");
    expect(openBrowserPane(ROOT)).toBe(false);
    expect(findBrowserLeaf(root())).toBeNull();
  });

  it("drops the history when the pane closes", () => {
    useAgentsPanesStore.getState().openSession(ROOT, "a");
    openUrlInBrowser(ROOT, "http://localhost:5173/", false);
    const browser = findBrowserLeaf(root())!;

    useAgentsPanesStore.getState().closeLeaf(ROOT, browser.id);

    expect(findBrowserLeaf(root())).toBeNull();
    expect(useBrowserHistoryStore.getState().byLeaf[browser.id]).toBeUndefined();
  });
});
