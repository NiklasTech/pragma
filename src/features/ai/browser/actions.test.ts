import { describe, expect, it } from "vite-plus/test";

import { parseActionReply } from "./actions";

describe("parseActionReply", () => {
  it("accepts only the answer to its own request", () => {
    const reply = { type: "pragma:browser-action-result", id: "a", ok: true, text: "Clicked" };
    expect(parseActionReply(reply, "a")).toEqual({ ok: true, text: "Clicked" });
    expect(parseActionReply(reply, "b")).toBeNull();
    expect(parseActionReply({ ...reply, type: "other" }, "a")).toBeNull();
    expect(parseActionReply({ ...reply, ok: "yes" }, "a")).toBeNull();
  });
});
