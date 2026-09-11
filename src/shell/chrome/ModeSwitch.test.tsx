import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

const modeState = vi.hoisted(() => ({ mode: "agents" as "agents" | "editor" }));

vi.mock("@/shell/mode", () => ({
  useUiMode: () => modeState.mode,
  useUiModeStore: (selector: (state: { setUiMode: () => void }) => unknown) =>
    selector({ setUiMode: () => {} }),
}));

import { ModeSwitch } from "./ModeSwitch";

function buttonFor(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
}

describe("ModeSwitch", () => {
  beforeEach(() => {
    modeState.mode = "agents";
  });

  it("renders a labelled segmented control for both modes", () => {
    const html = renderToStaticMarkup(<ModeSwitch />);

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Workspace mode"');
    expect(buttonFor(html, "Agents")).toContain('type="button"');
    expect(buttonFor(html, "Editor")).toContain('type="button"');
  });

  it("marks the active mode with aria-pressed", () => {
    const agentsHtml = renderToStaticMarkup(<ModeSwitch />);
    expect(buttonFor(agentsHtml, "Agents")).toContain('aria-pressed="true"');
    expect(buttonFor(agentsHtml, "Editor")).toContain('aria-pressed="false"');

    modeState.mode = "editor";
    const editorHtml = renderToStaticMarkup(<ModeSwitch />);
    expect(buttonFor(editorHtml, "Editor")).toContain('aria-pressed="true"');
    expect(buttonFor(editorHtml, "Agents")).toContain('aria-pressed="false"');
  });
});
