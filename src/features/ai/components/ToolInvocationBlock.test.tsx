import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolInvocationBlock } from "./ToolInvocationBlock";

describe("ToolInvocationBlock", () => {
  it("renders a collapsed tool call as one row without card chrome", () => {
    const html = renderToStaticMarkup(
      <ToolInvocationBlock
        toolCallId="call-1"
        toolName="read_file"
        state="output-available"
        input={{ path: "src/main.ts" }}
        output="file contents"
      />,
    );
    expect(html).toContain("read_file");
    expect(html.match(/<button/g) ?? []).toHaveLength(1);
    expect(html).not.toContain("my-2");
    expect(html).not.toContain("bg-bg-hover/30");
    expect(html).not.toContain("file contents");
  });

  it("expands args while running", () => {
    const html = renderToStaticMarkup(
      <ToolInvocationBlock
        toolCallId="call-2"
        toolName="read_file"
        state="output-streaming"
        input={{ path: "src/main.ts" }}
      />,
    );
    expect(html).toContain("animate-spin");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("src/main.ts");
  });

  it("keeps completed output collapsed until toggled", () => {
    const html = renderToStaticMarkup(
      <ToolInvocationBlock
        toolCallId="call-3"
        toolName="run_command"
        state="output-available"
        output="done"
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Output");
  });
});
