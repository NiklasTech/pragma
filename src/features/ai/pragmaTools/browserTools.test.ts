import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  console: vi.fn(),
  open: vi.fn(),
  back: vi.fn(),
  reload: vi.fn(),
}));

vi.mock("../browser/agentTool", () => ({
  currentBrowserPage: () => ({ leafId: "leaf-1", url: "http://localhost:5173/" }),
  runOpenBrowserTool: mocks.open,
}));
vi.mock("../browser/frames", () => ({
  loadedBrowserFrame: async () => ({ frame: { id: "frame" }, waited: false }),
}));
vi.mock("../browser/actions", () => ({ requestFrameAction: mocks.action }));
vi.mock("../browser/console", () => ({ requestFrameConsole: mocks.console }));
vi.mock("../browser/history", () => ({
  useBrowserHistoryStore: {
    getState: () => ({ back: mocks.back, forward: vi.fn(), reload: mocks.reload }),
  },
}));

const { BROWSER_TOOLS } = await import("./browserTools");

const context = { sessionId: "s1", requestId: "r1", cwd: "/p", rootPath: "/p" };

describe("BROWSER_TOOLS", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("clicks and types through the page's capture script", async () => {
    mocks.action.mockResolvedValue('Clicked button "Sign in"');
    await BROWSER_TOOLS.browser_click({ text: "Sign in" }, context);
    expect(mocks.action).toHaveBeenCalledWith({ id: "frame" }, "click", {
      selector: "",
      text: "Sign in",
    });
    await BROWSER_TOOLS.browser_type({ selector: "#email", value: "a@b.c", submit: true }, context);
    expect(mocks.action).toHaveBeenLastCalledWith({ id: "frame" }, "type", {
      selector: "#email",
      text: "",
      value: "a@b.c",
      submit: true,
    });
    await expect(BROWSER_TOOLS.browser_click({}, context)).rejects.toThrow("selector or the text");
  });

  it("opens a URL, or steps through the pane's history", async () => {
    mocks.open.mockReturnValue("Opened");
    await BROWSER_TOOLS.browser_navigate({ url: "http://localhost:3000" }, context);
    expect(mocks.open).toHaveBeenCalledWith({ url: "http://localhost:3000" });
    await expect(BROWSER_TOOLS.browser_navigate({ action: "back" }, context)).resolves.toBe(
      "Went back in the browser pane.",
    );
    expect(mocks.back).toHaveBeenCalledWith("leaf-1");
    await expect(BROWSER_TOOLS.browser_navigate({ action: "up" }, context)).rejects.toThrow(
      "action must be one of",
    );
  });

  it("lists only the failed requests of the page", async () => {
    mocks.console.mockResolvedValue({
      url: "http://localhost:5173/",
      entries: [
        { level: "error", text: "boom", time: 1 },
        { level: "network", text: "404 GET /api/todos", time: 2 },
      ],
    });
    await expect(BROWSER_TOOLS.browser_network({}, context)).resolves.toBe(
      "Failed requests of http://localhost:5173/:\n404 GET /api/todos",
    );
  });
});
