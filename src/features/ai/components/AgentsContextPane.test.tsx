import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

const agentsUi = vi.hoisted(() => ({ collapsed: true }));

vi.mock("../store/agentsUi", () => ({
  useAgentsUiStore: (
    selector: (state: {
      contextPaneCollapsed: boolean;
      contextPaneWidth: number;
      setContextPaneCollapsed: () => void;
      setContextPaneWidth: () => void;
    }) => unknown,
  ) =>
    selector({
      contextPaneCollapsed: agentsUi.collapsed,
      contextPaneWidth: 360,
      setContextPaneCollapsed: () => {},
      setContextPaneWidth: () => {},
    }),
}));

import { AgentsContextPane } from "./AgentsContextPane";

describe("AgentsContextPane", () => {
  beforeEach(() => {
    agentsUi.collapsed = true;
  });

  it("renders nothing while collapsed; the titlebar toggle reopens it", () => {
    const html = renderToStaticMarkup(<AgentsContextPane />);

    expect(html).toBe("");
  });

  it("renders the Review and Files tabs when expanded", () => {
    agentsUi.collapsed = false;

    const html = renderToStaticMarkup(<AgentsContextPane />);

    expect(html).toContain("Review");
    expect(html).toContain("Files");
    expect(html).toContain('aria-label="Collapse context pane"');
  });
});
