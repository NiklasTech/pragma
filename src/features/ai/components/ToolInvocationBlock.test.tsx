import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { outputPreview, titleDetail, ToolInvocationBlock } from "./ToolInvocationBlock";

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
    expect(html).toContain("file contents");
    expect(html).not.toContain("Output");
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

  it("shows a coding CLI's command and the first output lines", () => {
    const html = renderToStaticMarkup(
      <ToolInvocationBlock
        toolCallId="call-4"
        toolName="Bash"
        title="ls -la"
        state="output-available"
        input={{ command: "ls -la" }}
        output={"a\nb\nc\nd\ne"}
      />,
    );
    expect(html).toContain("Bash");
    expect(html).toContain("ls -la");
    expect(html).toContain("+2 lines");
    expect(html).not.toContain(">d<");
  });

  it("spins while a coding CLI's call waits for its output", () => {
    const html = renderToStaticMarkup(
      <ToolInvocationBlock
        toolCallId="call-5"
        toolName="Bash"
        state="input-available"
        input={{}}
        active
      />,
    );
    expect(html).toContain("animate-spin");
    expect(html).toContain('aria-expanded="false"');
  });
});

describe("titleDetail", () => {
  it("drops the tool name the title repeats", () => {
    expect(titleDetail("Read src/main.ts", "Read", "Read")).toBe("src/main.ts");
    expect(titleDetail("`*.ts`", "Glob", "Glob")).toBe("*.ts");
    expect(titleDetail("Terminal", "Terminal", "Terminal")).toBeUndefined();
    expect(titleDetail(undefined, "Bash", "Bash")).toBeUndefined();
  });
});

describe("outputPreview", () => {
  it("keeps three lines and counts the rest", () => {
    expect(outputPreview("1\n2\n3\n4\n")).toEqual({ lines: ["1", "2", "3"], hidden: 1 });
    expect(outputPreview("")).toEqual({ lines: [], hidden: 0 });
  });
});
