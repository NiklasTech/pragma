import { describe, expect, it } from "vite-plus/test";
import { extractSecretLikeEnv, looksSecretEnvKey, withoutSecretValues } from "./mcpSecretEnv";

const base = { id: "mcp-1", name: "GitHub", command: "npx", args: [], autostart: false };

describe("looksSecretEnvKey", () => {
  it("matches token, key and secret suffixes", () => {
    expect(looksSecretEnvKey("GITHUB_TOKEN")).toBe(true);
    expect(looksSecretEnvKey("openai_api_key")).toBe(true);
    expect(looksSecretEnvKey("CLIENT_SECRET")).toBe(true);
    expect(looksSecretEnvKey("NODE_ENV")).toBe(false);
    expect(looksSecretEnvKey("TOKEN_URL")).toBe(false);
  });
});

describe("withoutSecretValues", () => {
  it("removes values of secret keys and defaults the key list", () => {
    expect(
      withoutSecretValues({
        ...base,
        env: { GITHUB_TOKEN: "ghp_x", NODE_ENV: "production" },
        secretEnv: ["GITHUB_TOKEN"],
      }),
    ).toEqual({ ...base, env: { NODE_ENV: "production" }, secretEnv: ["GITHUB_TOKEN"] });

    expect(withoutSecretValues({ ...base, env: {} }).secretEnv).toEqual([]);
  });
});

describe("extractSecretLikeEnv", () => {
  it("moves secret-like plain values out of env", () => {
    const { server, values } = extractSecretLikeEnv({
      ...base,
      env: { GITHUB_TOKEN: "ghp_x", NODE_ENV: "production" },
    });

    expect(server.env).toEqual({ NODE_ENV: "production" });
    expect(server.secretEnv).toEqual(["GITHUB_TOKEN"]);
    expect(values).toEqual({ GITHUB_TOKEN: "ghp_x" });
  });
});
