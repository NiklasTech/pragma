import { describe, expect, it } from "vite-plus/test";

import type { GhCheck } from "./api";
import { buildFailureMessage } from "./failureMessage";

const URL = "https://github.com/o/r/pull/142";

function check(name: string, link = ""): GhCheck {
  return { name, workflow: "CI", bucket: "fail", link };
}

describe("buildFailureMessage", () => {
  it("names the pull request, the failed checks and what to do", () => {
    const message = buildFailureMessage({
      number: 142,
      url: URL,
      failing: [check("test"), check("typecheck")],
      total: 7,
      logs: [{ check: check("test"), excerpt: "FAIL redirect.test.ts\nexpected /inbox" }],
    });
    expect(message).toBe(
      [
        `CI failed on pull request #142 (${URL}): 2 of 7 checks failed: CI / test, CI / typecheck.`,
        "Find the cause, fix it, run the failing checks locally where you can, then commit and push to this branch.",
        "",
        "Last lines of CI / test:",
        "FAIL redirect.test.ts\nexpected /inbox",
      ].join("\n"),
    );
  });

  it("points to the log when no excerpt could be read", () => {
    const link = "https://ci.example.com/build/9";
    const message = buildFailureMessage({
      number: 142,
      url: URL,
      failing: [{ name: "deploy", workflow: "", bucket: "fail", link }],
      total: 1,
      logs: [],
    });
    expect(message).toContain("1 of 1 checks failed: deploy.");
    expect(message.endsWith(`The log is at ${link}.`)).toBe(true);
  });

  it("keeps the end of long logs within one budget for all of them", () => {
    const long = `${"a".repeat(7_000)}\nthe error`;
    const message = buildFailureMessage({
      number: 1,
      url: URL,
      failing: [check("one"), check("two")],
      total: 2,
      logs: [
        { check: check("one"), excerpt: long },
        { check: check("two"), excerpt: long },
      ],
    });
    expect(message).toContain("Last lines of CI / one:");
    expect(message).toContain("Last lines of CI / two:");
    expect(message.length).toBeLessThan(8_400);
    expect(message.endsWith("the error")).toBe(true);
  });
});
