import { describe, expect, it } from "vite-plus/test";

import { agentPaneState, terminalPaneLabel, terminalPaneState } from "./paneState";

describe("agentPaneState", () => {
  it("asks for the user on approvals and errors", () => {
    expect(agentPaneState("waiting-approval")).toBe("needs-you");
    expect(agentPaneState("error")).toBe("needs-you");
  });

  it("maps a run to working and its end to done", () => {
    expect(agentPaneState("running")).toBe("working");
    expect(agentPaneState("done")).toBe("done");
    expect(agentPaneState("cancelled")).toBe("idle");
  });
});

describe("terminalPaneState", () => {
  it("works while output arrives and is done while the CLI waits", () => {
    expect(terminalPaneState({ status: "running", exitCode: null, active: true })).toBe("working");
    expect(terminalPaneState({ status: "running", exitCode: null, active: false })).toBe("done");
  });

  it("needs the user only after a failed exit", () => {
    expect(terminalPaneState({ status: "exited", exitCode: 1, active: false })).toBe("needs-you");
    expect(terminalPaneState({ status: "exited", exitCode: 0, active: false })).toBe("idle");
    expect(terminalPaneState({ status: "cancelled", exitCode: null, active: false })).toBe("idle");
  });

  it("names the exit code", () => {
    expect(terminalPaneLabel({ status: "exited", exitCode: 2, active: false })).toBe(
      "Ended with an error",
    );
    expect(terminalPaneLabel({ status: "running", exitCode: null, active: false })).toBe(
      "Waiting for input",
    );
  });
});
