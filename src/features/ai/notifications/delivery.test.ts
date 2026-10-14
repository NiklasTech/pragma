import { describe, expect, it } from "vite-plus/test";

import { isSessionInView, resolveAttentionDelivery, type DeliveryInput } from "./delivery";

const base: DeliveryInput = {
  enabled: true,
  windowFocused: true,
  sessionInView: false,
  inAppPopups: true,
};

describe("resolveAttentionDelivery", () => {
  it("shows a system notification while Pragma is in the background", () => {
    expect(resolveAttentionDelivery({ ...base, windowFocused: false })).toBe("system");
    expect(resolveAttentionDelivery({ ...base, windowFocused: false, sessionInView: true })).toBe(
      "system",
    );
  });

  it("shows a popup while the session is out of view", () => {
    expect(resolveAttentionDelivery(base)).toBe("popup");
  });

  it("stays quiet for the session in view", () => {
    expect(resolveAttentionDelivery({ ...base, sessionInView: true })).toBe("none");
  });

  it("respects the event and popup settings", () => {
    expect(resolveAttentionDelivery({ ...base, enabled: false, windowFocused: false })).toBe(
      "none",
    );
    expect(resolveAttentionDelivery({ ...base, inAppPopups: false })).toBe("none");
  });
});

describe("isSessionInView", () => {
  const view = { uiMode: "agents" as const, boardOpen: false, focusedSessionId: "a" };

  it("is true only for the focused pane in the Agents view", () => {
    expect(isSessionInView("a", view)).toBe(true);
    expect(isSessionInView("b", view)).toBe(false);
  });

  it("is false in the editor or on the task board", () => {
    expect(isSessionInView("a", { ...view, uiMode: "editor" })).toBe(false);
    expect(isSessionInView("a", { ...view, boardOpen: true })).toBe(false);
  });
});
