import type { UIMessage } from "@ai-sdk/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useAgentStore } from "@/features/agent/store";
import { useAIStore } from "@/shared/stores/ai";

import { keepCheckpointsForEdit, restoreRewindFiles, rewindFiles } from "./actions";
import {
  checkpointsToRestore,
  recordRewindCheckpoint,
  useRewindCheckpointStore,
  type FileCheckpoint,
} from "./checkpoints";
import { rewindDescription } from "./RewindDialog";

function message(id: string, role: UIMessage["role"]): UIMessage {
  return { id, role, parts: [{ type: "text", text: id }] };
}

const thread = [
  message("u1", "user"),
  message("a1", "assistant"),
  message("u2", "user"),
  message("a2", "assistant"),
  message("u3", "user"),
  message("a3", "assistant"),
];

function checkpoint(messageId: string, path: string, before: string | null): FileCheckpoint {
  return { sessionId: "s1", messageId, path, before };
}

beforeEach(() => {
  invokeMock.mockReset();
  useRewindCheckpointStore.setState({ checkpoints: [] });
});

describe("checkpointsToRestore", () => {
  it("keeps the oldest checkpoint per path among the given turns", () => {
    const checkpoints = [
      checkpoint("u1", "/a.ts", "a0"),
      checkpoint("u2", "/a.ts", "a1"),
      checkpoint("u3", "/a.ts", "a2"),
      checkpoint("u3", "/b.ts", null),
      { ...checkpoint("u2", "/c.ts", "other"), sessionId: "s2" },
    ];
    expect(checkpointsToRestore(checkpoints, "s1", ["u2", "u3"])).toEqual([
      checkpoint("u2", "/a.ts", "a1"),
      checkpoint("u3", "/b.ts", null),
    ]);
  });
});

describe("rewindFiles", () => {
  it("only includes turns that start after the message", () => {
    useRewindCheckpointStore.setState({
      checkpoints: [checkpoint("u1", "/a.ts", "a0"), checkpoint("u3", "/b.ts", "b0")],
    });
    expect(rewindFiles("s1", thread, 3)).toEqual([checkpoint("u3", "/b.ts", "b0")]);
    expect(rewindFiles("s1", thread, 5)).toEqual([]);
  });
});

describe("restoreRewindFiles", () => {
  it("writes old content back, deletes created files and forgets the restored turns", async () => {
    useRewindCheckpointStore.setState({
      checkpoints: [
        checkpoint("u1", "/a.ts", "a0"),
        checkpoint("u2", "/a.ts", "a1"),
        checkpoint("u3", "/new.ts", null),
      ],
    });
    invokeMock.mockResolvedValue(undefined);

    const failed = await restoreRewindFiles("s1", thread, 1);

    expect(failed).toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith("write_text_file", { path: "/a.ts", content: "a1" });
    expect(invokeMock).toHaveBeenCalledWith("delete_file", { path: "/new.ts" });
    expect(useRewindCheckpointStore.getState().checkpoints).toEqual([
      checkpoint("u1", "/a.ts", "a0"),
    ]);
  });

  it("reports files that could not be restored", async () => {
    useRewindCheckpointStore.setState({ checkpoints: [checkpoint("u2", "/a.ts", "a1")] });
    invokeMock.mockRejectedValue("Permission denied");

    expect(await restoreRewindFiles("s1", thread, 1)).toEqual(["/a.ts"]);
  });
});

describe("keepCheckpointsForEdit", () => {
  it("moves later turns onto the edited message so a rewind still restores them", () => {
    useRewindCheckpointStore.setState({
      checkpoints: [checkpoint("u2", "/a.ts", "a1"), checkpoint("u3", "/b.ts", "b0")],
    });
    keepCheckpointsForEdit("s1", thread, 2);
    expect(useRewindCheckpointStore.getState().checkpoints).toEqual([
      checkpoint("u2", "/a.ts", "a1"),
      checkpoint("u2", "/b.ts", "b0"),
    ]);
  });
});

describe("recordRewindCheckpoint", () => {
  beforeEach(() => {
    useAgentStore.setState({ runSessionId: "s1" });
    useAIStore.setState({
      chatSessions: [
        {
          id: "s1",
          title: "Thread",
          createdAt: 0,
          updatedAt: 0,
          messages: [
            { id: "u1", role: "user", content: "first", timestamp: 0 },
            { id: "a1", role: "assistant", content: "done", timestamp: 0 },
            { id: "u2", role: "user", content: "second", timestamp: 0 },
          ],
        },
      ],
    });
  });

  it("records the content before the first write of the current turn only", async () => {
    invokeMock.mockResolvedValueOnce({ content: "original" });
    await recordRewindCheckpoint("/a.ts");
    await recordRewindCheckpoint("/a.ts");
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(useRewindCheckpointStore.getState().checkpoints).toEqual([
      checkpoint("u2", "/a.ts", "original"),
    ]);
  });

  it("marks files that do not exist yet as created", async () => {
    invokeMock.mockRejectedValueOnce("File not found: /new.ts");
    await recordRewindCheckpoint("/new.ts");
    expect(useRewindCheckpointStore.getState().checkpoints).toEqual([
      checkpoint("u2", "/new.ts", null),
    ]);
  });

  it("skips files it cannot read", async () => {
    invokeMock.mockRejectedValueOnce("Binary files are not supported");
    await recordRewindCheckpoint("/image.png");
    expect(useRewindCheckpointStore.getState().checkpoints).toEqual([]);
  });
});

describe("rewindDescription", () => {
  it("says when no files can be restored", () => {
    expect(rewindDescription(1, 0)).toBe(
      "1 later message is removed from this thread. No files the agent changed after this point can be restored.",
    );
  });

  it("introduces the file list", () => {
    expect(rewindDescription(4, 2)).toBe(
      "4 later messages are removed from this thread. These files go back to their state at this point:",
    );
  });
});
