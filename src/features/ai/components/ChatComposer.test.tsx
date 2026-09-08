import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatComposer } from "./ChatComposer";

function noop() {}

describe("ChatComposer", () => {
  const baseProps = {
    input: "",
    onInputChange: noop,
    onSubmit: noop,
    isLoading: false,
    isStreaming: false,
    canChat: true,
    mcpLoaded: true,
    onStop: noop,
  };

  it("renders one input card with textarea, context add and send", () => {
    const html = renderToStaticMarkup(<ChatComposer {...baseProps} />);
    expect(html).toContain("Ask anything...");
    expect(html).toContain('aria-label="Add context"');
    expect(html).toContain('aria-label="Send"');
    expect(html).toContain("flex-nowrap");
  });

  it("keeps send visible and shrinkable in the action row", () => {
    const html = renderToStaticMarkup(<ChatComposer {...baseProps} />);
    expect(html).toContain("shrink-0");
    expect(html).not.toContain("flex-wrap");
  });

  it("shows stop instead of send while streaming", () => {
    const html = renderToStaticMarkup(<ChatComposer {...baseProps} isLoading isStreaming />);
    expect(html).toContain('aria-label="Stop"');
    expect(html).not.toContain('aria-label="Send"');
  });

  it("disables the composer and points to Settings when unconfigured", () => {
    const html = renderToStaticMarkup(<ChatComposer {...baseProps} canChat={false} />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("Configure a provider in Settings");
  });
});
