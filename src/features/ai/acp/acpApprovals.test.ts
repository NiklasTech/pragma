import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { addAcpApproval, resolveAcpApproval, useAcpApprovalsStore } from "./acpApprovals";

const request = (toolCallId: string, chatSessionId = "chat") => ({
  chatSessionId,
  toolCallId,
  toolName: "`cargo test`",
});

describe("ACP approvals", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    useAcpApprovalsStore.setState({ bySession: {} });
  });

  it("keeps requests per session and sends the chosen decision once", async () => {
    addAcpApproval(request("a"));
    addAcpApproval(request("b"));
    addAcpApproval(request("c", "other"));

    await resolveAcpApproval("chat", "a", "allow_always");
    await resolveAcpApproval("chat", "a", "deny");

    const { bySession } = useAcpApprovalsStore.getState();
    expect(bySession.chat?.map((item) => item.toolCallId)).toEqual(["b"]);
    expect(bySession.other).toHaveLength(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("cli_acp_approve", {
      req: { tool_call_id: "a", decision: "allow_always" },
    });
  });

  it("drops the request even when the CLI no longer waits for it", async () => {
    invokeMock.mockRejectedValue(new Error("no pending approval"));
    addAcpApproval(request("a"));
    await resolveAcpApproval("chat", "a", "allow");
    expect(useAcpApprovalsStore.getState().bySession.chat).toEqual([]);
  });
});
