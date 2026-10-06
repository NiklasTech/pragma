import { describe, expect, it } from "vite-plus/test";

import { envRecord } from "./terminalEnv";

describe("envRecord", () => {
  it("trims names, skips empty names and keeps the last duplicate", () => {
    expect(
      envRecord([
        { key: " NODE_ENV ", value: "development" },
        { key: "", value: "ignored" },
        { key: "A", value: "1" },
        { key: "A", value: "2" },
      ]),
    ).toEqual({ NODE_ENV: "development", A: "2" });
  });
});
