import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { ComposerMicButton } from "./ComposerMicButton";

function noop() {}

describe("ComposerMicButton", () => {
  it("labels idle and recording states", () => {
    const idle = renderToStaticMarkup(<ComposerMicButton recording={false} onClick={noop} />);
    expect(idle).toContain('aria-label="Dictate"');
    expect(idle).toContain('aria-pressed="false"');

    const recording = renderToStaticMarkup(<ComposerMicButton recording onClick={noop} />);
    expect(recording).toContain('aria-label="Stop dictation"');
    expect(recording).toContain('aria-pressed="true"');
    expect(recording).toContain("animate-pulse");
  });

  it("shows a level ring instead of pulsing when the level is metered", () => {
    const subscribeLevel = () => noop;
    const metered = renderToStaticMarkup(
      <ComposerMicButton recording onClick={noop} subscribeLevel={subscribeLevel} />,
    );
    expect(metered).toContain('data-slot="mic-level"');
    expect(metered).not.toContain("animate-pulse");

    const idle = renderToStaticMarkup(
      <ComposerMicButton recording={false} onClick={noop} subscribeLevel={subscribeLevel} />,
    );
    expect(idle).not.toContain('data-slot="mic-level"');
  });
});
