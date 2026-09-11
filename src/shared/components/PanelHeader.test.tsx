import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { Files } from "@phosphor-icons/react";

import { PanelHeader } from "./PanelHeader";

describe("PanelHeader", () => {
  it("renders nothing when title, subtitle and actions are all empty", () => {
    expect(renderToStaticMarkup(<PanelHeader />)).toBe("");
  });

  it("renders a compact single-line bar", () => {
    const html = renderToStaticMarkup(<PanelHeader title="my-folder" />);
    expect(html).toContain("my-folder");
    expect(html).toContain("h-8");
    expect(html).toContain("px-3");
    expect(html).toContain("text-ui-sm");
  });

  it("renders no accent icon tile even when an icon is passed", () => {
    const html = renderToStaticMarkup(<PanelHeader icon={Files} title="my-folder" />);
    expect(html).not.toContain("bg-accent-subtle");
  });

  it("right-aligns icon-only actions when the title is omitted", () => {
    const html = renderToStaticMarkup(
      <PanelHeader
        actions={
          <button type="button" aria-label="Copy">
            c
          </button>
        }
      />,
    );
    expect(html).toContain("justify-end");
    expect(html).toContain('aria-label="Copy"');
  });
});
