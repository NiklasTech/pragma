import { describe, expect, it } from "vite-plus/test";

import { enterApproves, type EnterContext } from "./approvalKeys";

const base: EnterContext = {
  key: "Enter",
  composing: false,
  modified: false,
  inScope: true,
  onControl: false,
  fieldText: null,
};

describe("enterApproves", () => {
  it("allows on a plain Enter in the request's pane", () => {
    expect(enterApproves(base)).toBe(true);
    expect(enterApproves({ ...base, fieldText: "  " })).toBe(true);
  });

  it("leaves typed text, other panes, buttons and modified keys alone", () => {
    expect(enterApproves({ ...base, fieldText: "fix the test" })).toBe(false);
    expect(enterApproves({ ...base, inScope: false })).toBe(false);
    expect(enterApproves({ ...base, onControl: true })).toBe(false);
    expect(enterApproves({ ...base, modified: true })).toBe(false);
    expect(enterApproves({ ...base, composing: true })).toBe(false);
    expect(enterApproves({ ...base, key: "a" })).toBe(false);
  });
});
