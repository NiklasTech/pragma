import { describe, expect, it } from "vite-plus/test";

import { buildFailureMessage } from "./failureMessage";

describe("buildFailureMessage", () => {
  it("asks for an explanation with the command, exit code and output", () => {
    expect(
      buildFailureMessage({ command: "npm test", exitCode: 1, output: "1 test failed" }, "explain"),
    ).toBe(
      [
        "Explain why this terminal command failed and how to fix it.",
        "Command (exit code 1):\n```sh\nnpm test\n```",
        "Output:\n```\n1 test failed\n```",
      ].join("\n\n"),
    );
  });

  it("asks the session for a fix and fences output that contains backticks", () => {
    const message = buildFailureMessage(
      { command: "", exitCode: null, output: "see ```code```" },
      "session",
    );

    expect(message).toContain("This terminal command failed. Find the cause and fix it.");
    expect(message).toContain("Command (exit code unknown):\n```sh\n(unknown command)\n```");
    expect(message).toContain("Output:\n````\nsee ```code```\n````");
  });

  it("marks empty output", () => {
    expect(buildFailureMessage({ command: "false", exitCode: 1, output: "" }, "explain")).toContain(
      "Output:\n```\n(no output)\n```",
    );
  });
});
