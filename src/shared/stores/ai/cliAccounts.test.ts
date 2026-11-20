import { describe, expect, it } from "vite-plus/test";

import { accountLabel, sessionAccountLabel, type CliAccount } from "./cliAccounts";

function account(configDir: string | null, email: string | null): CliAccount {
  return {
    providerId: "anthropic-claude",
    configDir,
    email,
    displayName: null,
    organizationName: null,
    available: true,
  };
}

describe("cli accounts", () => {
  it("labels an account by its name, then its email, then its folder", () => {
    const work = account("/Users/me/.claude-work", null);
    expect(accountLabel(work, {})).toBe(".claude-work");
    expect(accountLabel({ ...work, email: "me@work.test" }, {})).toBe("me@work.test");
    expect(accountLabel(work, { "anthropic-claude:/Users/me/.claude-work": " work " })).toBe(
      "work",
    );
    expect(accountLabel(account(null, null), {})).toBe("default");
  });

  it("names a session's account only when the CLI has several", () => {
    const one = [account(null, "a@x.test")];
    const two = [...one, account("/w", "b@x.test")];
    expect(sessionAccountLabel(one, {}, "anthropic-claude", undefined)).toBeNull();
    expect(sessionAccountLabel(two, {}, "anthropic-claude", undefined)).toBe("a@x.test");
    expect(sessionAccountLabel(two, {}, "anthropic-claude", "/w")).toBe("b@x.test");
    expect(sessionAccountLabel(two, {}, "anthropic-claude", "/removed/.claude-old")).toBe(
      ".claude-old",
    );
  });
});
