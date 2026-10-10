import { describe, expect, it, vi } from "vite-plus/test";

const listen = vi.fn();

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ listen }),
}));

const { listenFileDrop } = await import("./dragDrop");

describe("listenFileDrop", () => {
  it("passes drops on with their paths and position", async () => {
    const handlers = new Map<string, (event: { payload: unknown }) => void>();
    listen.mockImplementation(async (event: string, handler: (e: { payload: unknown }) => void) => {
      handlers.set(event, handler);
      return async () => {};
    });
    const handler = vi.fn();
    await listenFileDrop(handler);

    handlers.get("tauri://drag-drop")?.({
      payload: { paths: ["/tmp/a.png"], position: { x: 4, y: 8 } },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "drop", paths: ["/tmp/a.png"] }),
    );
    expect(handler.mock.calls[0][0].position).toMatchObject({ x: 4, y: 8 });
  });

  it("retries an unlisten that rejects instead of leaving the rejection unhandled", async () => {
    const racing = vi.fn(async () => {}).mockRejectedValueOnce(new Error("registration race"));
    listen.mockImplementation(async () => racing);

    const unlisten = await listenFileDrop(() => {});
    await expect(Promise.resolve(unlisten())).resolves.toBeUndefined();
    expect(racing).toHaveBeenCalledTimes(5);
  });
});
