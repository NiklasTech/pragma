import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { SessionUsageBadge } from "./SessionUsageBadge";

describe("SessionUsageBadge", () => {
  it("shows the session total", () => {
    const html = renderToStaticMarkup(
      <SessionUsageBadge
        usage={{
          inputTokens: 12_000,
          outputTokens: 3400,
          cacheReadTokens: 9000,
          cacheWriteTokens: 0,
          responses: 4,
        }}
      />,
    );
    expect(html).toContain("15k tokens");
    expect(html).toContain("15,400 tokens used in this session");
  });

  it("renders nothing before a model reported usage", () => {
    expect(renderToStaticMarkup(<SessionUsageBadge usage={undefined} />)).toBe("");
  });
});
