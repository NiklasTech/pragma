import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatEmptyState } from "./ChatEmptyState";

describe("ChatEmptyState", () => {
  it("shows a single short prompt line without marketing copy", () => {
    const html = renderToStaticMarkup(<ChatEmptyState />);
    expect(html).toContain("Ask about the codebase.");
    expect(html).not.toContain("What are we building?");
    expect(html).not.toContain("Start typing or pick a suggestion");
  });
});
