import { beforeEach, describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { useSettingsStore } from "@/shared/stores/settings";

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

  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      ai: { ...state.ai, voiceInput: true, voiceEngine: "web-speech" },
    }));
  });

  it("renders one input card with textarea, context add, mic and send", () => {
    const html = renderToStaticMarkup(<ChatComposer {...baseProps} />);
    expect(html).toContain("Ask anything...");
    expect(html).toContain('aria-label="Add context"');
    expect(html).toContain('aria-label="Dictate"');
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

  it("keeps textarea and mic enabled and send disabled when unconfigured", () => {
    const html = renderToStaticMarkup(<ChatComposer {...baseProps} canChat={false} />);
    const textarea = html.match(/<textarea[\s\S]*?<\/textarea>/)?.[0] ?? "";
    expect(textarea).not.toContain("disabled=");
    expect(html).toContain('aria-label="Dictate"');
    expect(html).toContain("Configure a provider in Settings");
    expect(html).toMatch(/aria-label="Send"[^>]*disabled/);
  });
});
