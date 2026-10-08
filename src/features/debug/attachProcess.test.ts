import { describe, expect, it } from "vite-plus/test";
import { isAttachAdapter, parsePort, portAttachConfig, processAttachConfig } from "./attachProcess";

describe("parsePort", () => {
  it("accepts ports in range", () => {
    expect(parsePort("9229")).toBe(9229);
    expect(parsePort(" 1 ")).toBe(1);
    expect(parsePort("65535")).toBe(65535);
  });

  it("rejects empty, out of range and non-numeric input", () => {
    expect(parsePort("")).toBeNull();
    expect(parsePort("0")).toBeNull();
    expect(parsePort("65536")).toBeNull();
    expect(parsePort("92a9")).toBeNull();
    expect(parsePort("-1")).toBeNull();
  });
});

describe("attach configs", () => {
  it("builds a host and port attach config", () => {
    const config = portAttachConfig("node", "  ", 9229);
    expect(config.name).toBe("Attach to localhost:9229");
    expect(config.command).toBe("");
    expect(config.debug).toEqual({
      adapter: "node",
      request: "attach",
      host: "localhost",
      port: 9229,
    });
  });

  it("builds an lldb process attach config", () => {
    const config = processAttachConfig(4242, "server");
    expect(config.name).toBe("Attach to server (4242)");
    expect(config.debug).toEqual({ adapter: "lldb", request: "attach", processId: 4242 });
  });

  it("recognizes attach adapters", () => {
    expect(isAttachAdapter("python")).toBe(true);
    expect(isAttachAdapter("go")).toBe(false);
    expect(isAttachAdapter(null)).toBe(false);
  });
});
