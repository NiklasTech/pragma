import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatToolbar } from "./ChatToolbar";

describe("ChatToolbar", () => {
  it("renders one compact mode dropdown trigger labeled Ask by default", () => {
    const html = renderToStaticMarkup(<ChatToolbar />);
    expect(html).toContain("Ask");
    expect(html.match(/<button/g)?.length).toBe(1);
  });

  it("no longer renders three always-visible mode toggles", () => {
    const html = renderToStaticMarkup(<ChatToolbar />);
    expect(html).not.toContain("Agent mode");
    expect(html).not.toContain("Yolo mode");
  });

  it("keeps the mode trigger narrow-aware without wrapping", () => {
    const html = renderToStaticMarkup(<ChatToolbar />);
    expect(html).toContain("@max-[320px]:hidden");
    expect(html).not.toContain("flex-wrap");
  });
});
