import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { AiModelSelector } from "./AiModelSelector";

describe("AiModelSelector", () => {
  it("compact shows only the truncated model label with the full provider as title", () => {
    const html = renderToStaticMarkup(<AiModelSelector variant="compact" />);
    expect(html).toContain('title="Anthropic / No model"');
    const visible = html.replace(/ title="[^"]*"/g, "");
    expect(visible).toContain("No model");
    expect(visible).not.toContain("Anthropic");
  });

  it("default still shows the provider and model label", () => {
    const html = renderToStaticMarkup(<AiModelSelector variant="default" />);
    expect(html).toContain("Anthropic");
    expect(html).toContain("No model");
  });

  it("icon variant shows no text label", () => {
    const html = renderToStaticMarkup(<AiModelSelector variant="icon" />);
    expect(html).toContain('title="Anthropic / No model"');
    const visible = html.replace(/ title="[^"]*"/g, "");
    expect(visible).not.toContain("No model");
    expect(visible).not.toContain("Anthropic");
  });
});
