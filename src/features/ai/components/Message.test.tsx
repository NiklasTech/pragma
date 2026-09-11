import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { Message, MessageContent, MessageResponse } from "./Message";

describe("Message", () => {
  it("renders a user turn as a full-width left block, not a primary bubble", () => {
    const html = renderToStaticMarkup(
      <Message from="user">
        <MessageContent>hello</MessageContent>
      </Message>,
    );
    expect(html).toContain("w-full");
    expect(html).not.toContain("justify-end");
    expect(html).not.toContain("bg-primary");
    expect(html).not.toContain("rounded-2xl");
    expect(html).not.toContain("max-w-[92%]");
  });

  it("renders an assistant turn as full-width prose without card chrome", () => {
    const html = renderToStaticMarkup(
      <Message from="assistant">
        <MessageContent>answer</MessageContent>
      </Message>,
    );
    expect(html).toContain("w-full");
    expect(html).not.toContain("bg-bg-elevated");
    expect(html).not.toContain("border-border");
    expect(html).not.toContain("rounded-2xl");
  });

  it("keeps markdown rendering in MessageResponse", () => {
    const html = renderToStaticMarkup(<MessageResponse>{"**bold**"}</MessageResponse>);
    expect(html).toContain('data-streamdown="strong"');
    expect(html).toContain("bold");
  });
});
