import { describe, expect, it } from "vite-plus/test";

import {
  TASK_NOTES_MAX,
  TASK_RESULT_MAX,
  TASK_TITLE_MAX,
  buildTaskMessage,
  clampResult,
  validateTaskFields,
} from "./validation";

describe("task field validation", () => {
  it("requires a title of 1 to 120 characters", () => {
    expect(validateTaskFields({ title: "   ", notes: "", result: "" })).not.toBeNull();
    expect(
      validateTaskFields({ title: "x".repeat(TASK_TITLE_MAX + 1), notes: "", result: "" }),
    ).not.toBeNull();
    expect(
      validateTaskFields({ title: "x".repeat(TASK_TITLE_MAX), notes: "", result: "" }),
    ).toBeNull();
  });

  it("limits notes and result", () => {
    expect(
      validateTaskFields({ title: "Fix", notes: "x".repeat(TASK_NOTES_MAX + 1), result: "" }),
    ).not.toBeNull();
    expect(
      validateTaskFields({ title: "Fix", notes: "", result: "x".repeat(TASK_RESULT_MAX + 1) }),
    ).not.toBeNull();
  });
});

describe("task message", () => {
  it("joins the title and notes", () => {
    expect(buildTaskMessage({ title: " Fix login ", notes: "Use the new API.\n" })).toBe(
      "Fix login\n\nUse the new API.",
    );
  });

  it("uses the title alone without notes", () => {
    expect(buildTaskMessage({ title: "Fix login", notes: "  " })).toBe("Fix login");
  });

  it("clamps a result to the limit", () => {
    expect(clampResult("x".repeat(TASK_RESULT_MAX + 10))).toHaveLength(TASK_RESULT_MAX);
  });
});
