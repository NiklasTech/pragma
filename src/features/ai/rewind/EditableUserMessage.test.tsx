import type { UIMessage } from "@ai-sdk/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { EditableUserMessage } from "./EditableUserMessage";

const message: UIMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "Fix it" }] };

function render(canEdit: boolean): string {
  return renderToStaticMarkup(
    <EditableUserMessage
      message={message}
      text="Fix it"
      canEdit={canEdit}
      onResend={() => Promise.resolve(true)}
    />,
  );
}

describe("EditableUserMessage", () => {
  it("offers editing when the thread is idle", () => {
    const html = render(true);
    expect(html).toContain("Fix it");
    expect(html).toContain('aria-label="Edit message"');
  });

  it("hides editing while it is not allowed", () => {
    const html = render(false);
    expect(html).toContain("Fix it");
    expect(html).not.toContain('aria-label="Edit message"');
  });
});
