import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { QueuedMessageCard } from "./QueuedMessageCard";

function noop() {}

describe("QueuedMessageCard", () => {
  it("renders the queued label, full text and remove button", () => {
    const html = renderToStaticMarkup(
      <QueuedMessageCard text="Next instruction" onRemove={noop} />,
    );
    expect(html).toContain("Queued");
    expect(html).toContain("Next instruction");
    expect(html).toContain('title="Next instruction"');
    expect(html).toContain('aria-label="Remove queued message"');
  });

  it("keeps the text on one truncated line", () => {
    const html = renderToStaticMarkup(
      <QueuedMessageCard text="A longer instruction that should truncate" onRemove={noop} />,
    );
    expect(html).toContain("truncate");
  });
});
