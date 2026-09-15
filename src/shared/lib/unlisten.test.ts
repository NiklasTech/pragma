import { describe, expect, it, vi } from "vite-plus/test";
import { unlistenQuietly } from "./unlisten";

describe("unlistenQuietly", () => {
  it("does nothing without an unlisten function", async () => {
    await expect(unlistenQuietly(null)).resolves.toBeUndefined();
    await expect(unlistenQuietly(undefined)).resolves.toBeUndefined();
  });

  it("calls unlisten once when it resolves", async () => {
    const unlisten = vi.fn(async () => {});
    await unlistenQuietly(unlisten);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("retries after a rejection until the unlisten succeeds", async () => {
    const unlisten = vi.fn(async () => {}).mockRejectedValueOnce(new Error("registration race"));
    await unlistenQuietly(unlisten);
    expect(unlisten).toHaveBeenCalledTimes(2);
  });

  it("gives up quietly when every attempt rejects", async () => {
    const unlisten = vi.fn(async () => {
      throw new Error("registration race");
    });
    await expect(unlistenQuietly(unlisten)).resolves.toBeUndefined();
    expect(unlisten).toHaveBeenCalledTimes(3);
  });
});
