import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { selectTabAt } from "./tabShortcuts";

describe("selectTabAt", () => {
  beforeEach(() => {
    useOpenRepositoriesStore.setState({
      activeSpaceId: "s1",
      spaces: [
        {
          id: "s1",
          name: "Test",
          folders: ["/test"],
          tabs: [
            { id: "t1", name: "Agents", kind: "agents" },
            { id: "t2", name: "Code", kind: "code" },
          ],
          activeTabId: "t1",
        },
      ],
    });
  });

  it("shows the tab at that position", () => {
    expect(selectTabAt(1)).toBe(true);
    expect(useOpenRepositoriesStore.getState().spaces[0].activeTabId).toBe("t2");
  });

  it("lets the key through when there is no tab at that position", () => {
    expect(selectTabAt(4)).toBe(false);
    expect(useOpenRepositoriesStore.getState().spaces[0].activeTabId).toBe("t1");
  });
});
