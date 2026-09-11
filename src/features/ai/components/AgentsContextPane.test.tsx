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

  it("renders a collapsed strip by default", () => {
    const html = renderToStaticMarkup(<AgentsContextPane />);

    expect(html).toContain('aria-label="Context"');
    expect(html).toContain('aria-label="Expand context pane"');
    expect(html).not.toContain("Collapse context pane");
  });

  it("renders the Review and Files tabs when expanded", () => {
    agentsUi.collapsed = false;

    const html = renderToStaticMarkup(<AgentsContextPane />);

    expect(html).toContain("Review");
    expect(html).toContain("Files");
    expect(html).toContain('aria-label="Collapse context pane"');
  });
});
