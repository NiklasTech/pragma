import { describe, expect, it } from "vite-plus/test";

import { currentUrl, pushUrl, stepHistory, type BrowserHistory } from "./history";

const EMPTY: BrowserHistory = { entries: [], index: -1, reloadToken: 0 };

describe("browser history", () => {
  it("walks back and forward within its own entries", () => {
    const visited = pushUrl(pushUrl(EMPTY, "http://localhost:3000/"), "http://localhost:3000/a");
    const back = stepHistory(visited, -1);
    expect(currentUrl(back)).toBe("http://localhost:3000/");
    expect(stepHistory(back, -1)).toBe(back);
    expect(currentUrl(stepHistory(back, 1))).toBe("http://localhost:3000/a");
  });

  it("drops forward entries on a new navigation", () => {
    const visited = pushUrl(pushUrl(EMPTY, "http://localhost/a"), "http://localhost/b");
    const next = pushUrl(stepHistory(visited, -1), "http://localhost/c");
    expect(next.entries).toEqual(["http://localhost/a", "http://localhost/c"]);
  });

  it("reloads instead of duplicating the current URL", () => {
    const visited = pushUrl(EMPTY, "http://localhost/a");
    const again = pushUrl(visited, "http://localhost/a");
    expect(again.entries).toHaveLength(1);
    expect(again.reloadToken).toBe(1);
  });
});
