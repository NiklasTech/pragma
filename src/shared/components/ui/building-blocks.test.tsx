import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { X } from "@phosphor-icons/react";

import { AgentMark } from "./agent-mark";
import { Chip } from "./chip";
import { ICON_SIZE, IconButton } from "./icon-button";
import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
  overlaySheetVariants,
} from "./overlay-sheet";
import { SegmentedControl } from "./segmented-control";
import { StatusDot } from "./status-dot";
import { TooltipProvider } from "./tooltip";

describe("StatusDot", () => {
  it.each([
    ["needs-you", "Needs you", "animate-pulse"],
    ["working", "Working", "animate-spin"],
    ["done", "Done", "bg-state-done"],
    ["idle", "Idle", "border-state-idle"],
  ] as const)("shows %s with a label and its own look", (state, label, look) => {
    const html = renderToStaticMarkup(<StatusDot state={state} />);
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('role="img"');
    expect(html).toContain(look);
  });

  it("animates only when motion is allowed", () => {
    for (const state of ["needs-you", "working"] as const) {
      const html = renderToStaticMarkup(<StatusDot state={state} />);
      expect(html).toMatch(/motion-safe:animate-(pulse|spin)/);
      expect(html).not.toMatch(/(^|[\s"])animate-(pulse|spin)/);
    }
  });

  it("hides itself from screen readers when decorative", () => {
    const html = renderToStaticMarkup(<StatusDot state="done" decorative />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-label");
  });
});

describe("AgentMark", () => {
  it("shows the letter in the agent color and names the agent", () => {
    const html = renderToStaticMarkup(<AgentMark agentId="openai-codex" name="OpenAI Codex" />);
    expect(html).toContain("bg-agent-codex");
    expect(html).toContain(">X<");
    expect(html).toContain('aria-label="OpenAI Codex"');
  });

  it("adds the state to the name and a decorative dot", () => {
    const html = renderToStaticMarkup(
      <AgentMark agentId="anthropic-claude" name="Claude Code" state="needs-you" />,
    );
    expect(html).toContain('aria-label="Claude Code, needs you"');
    expect(html).toContain('data-slot="status-dot"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("uses the neutral color for CLIs without an agent color", () => {
    const html = renderToStaticMarkup(<AgentMark agentId="xai-grok" name="Grok Build" />);
    expect(html).toContain("bg-agent-other");
  });
});

describe("Chip", () => {
  it.each([
    ["neutral", "text-fg-muted"],
    ["needs-you", "text-state-needs-you"],
    ["done", "text-state-done"],
  ] as const)("renders the %s variant", (variant, look) => {
    const html = renderToStaticMarkup(<Chip variant={variant}>label</Chip>);
    expect(html).toContain(`data-variant="${variant}"`);
    expect(html).toContain(look);
  });

  it("defaults to neutral", () => {
    expect(renderToStaticMarkup(<Chip>draft</Chip>)).toContain('data-variant="neutral"');
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "unified", label: "Unified" },
    { value: "split", label: "Split", count: 3 },
  ] as const;

  it("names the group and marks the selected segment as pressed", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        label="Diff view"
        value="split"
        onValueChange={() => {}}
        options={[...options]}
      />,
    );
    expect(html).toContain('aria-label="Diff view"');
    expect(html).toContain('role="group"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Split/);
    expect(html).toContain(">3<");
  });
});

describe("IconButton", () => {
  it("uses the label as the accessible name and one of two icon sizes", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <IconButton icon={X} label="Close pane" size="sm" />
      </TooltipProvider>,
    );
    expect(html).toContain('aria-label="Close pane"');
    expect(html).toContain(`width="${ICON_SIZE.sm}"`);
    expect(Object.values(ICON_SIZE)).toEqual([14, 16]);
  });
});

describe("OverlaySheet", () => {
  it("places sheets in the center or near the top", () => {
    expect(overlaySheetVariants()).toContain("my-auto");
    expect(overlaySheetVariants({ placement: "top" })).toContain("top-[12vh]");
    expect(overlaySheetVariants()).toContain("rounded-sheet");
    expect(overlaySheetVariants()).toContain("bg-bg-sheet");
  });

  it("renders nothing while closed", () => {
    const html = renderToStaticMarkup(
      <OverlaySheet open={false}>
        <OverlaySheetContent>
          <OverlaySheetTitle>Spaces</OverlaySheetTitle>
        </OverlaySheetContent>
      </OverlaySheet>,
    );
    expect(html).not.toContain("Spaces");
  });
});
