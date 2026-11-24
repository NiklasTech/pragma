import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ startChildRun: vi.fn(), error: vi.fn() }));

vi.mock("../children/runner", () => ({ startChildRun: mocks.startChildRun }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

import { clearPendingFirstMessage, takePendingFirstMessage } from "../home/pendingFirstMessage";
import { sendChatTasks } from "./chatTasks";

describe("sendChatTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startChildRun.mockResolvedValue(undefined);
    clearPendingFirstMessage();
  });

  it("leaves a single task to its own chat, not to one that is open elsewhere", async () => {
    await sendChatTasks("/repo", [{ sessionId: "new", prompt: "Fix the login" }]);
    expect(mocks.startChildRun).not.toHaveBeenCalled();
    expect(takePendingFirstMessage("other")).toBeNull();
    expect(takePendingFirstMessage("new")).toBe("Fix the login");
    expect(takePendingFirstMessage("new")).toBeNull();
  });

  it("starts several chats at once and goes on when one fails", async () => {
    mocks.startChildRun.mockRejectedValueOnce(new Error("not signed in"));
    await sendChatTasks("/repo", [
      { sessionId: "a", prompt: "one" },
      { sessionId: "b", prompt: "two" },
    ]);
    expect(mocks.startChildRun.mock.calls).toEqual([
      ["/repo", "a", "one"],
      ["/repo", "b", "two"],
    ]);
    expect(mocks.error).toHaveBeenCalledWith("not signed in");
    expect(takePendingFirstMessage("a")).toBeNull();
  });

  it("does nothing without tasks", async () => {
    await sendChatTasks("/repo", []);
    expect(mocks.startChildRun).not.toHaveBeenCalled();
  });
});
