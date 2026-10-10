import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

import { attachPtyOutput, ensurePtyOutputListener, releasePtyOutput, startPty } from "./ptyOutput";

let emit: (id: string, data: string) => void = () => {};

beforeAll(async () => {
  listenMock.mockImplementation(
    (_event: string, handler: (event: { payload: { id: string; data: string } }) => void) => {
      emit = (id, data) => handler({ payload: { id, data } });
      return Promise.resolve(() => {});
    },
  );
  await ensurePtyOutputListener();
});

describe("ptyOutput", () => {
  it("replays the output to a terminal that attaches again", async () => {
    const ptyId = await startPty(() => Promise.resolve("pty-a"));
    const first: string[] = [];
    const detach = attachPtyOutput(
      ptyId,
      () => {},
      (data) => first.push(data),
    );
    emit("pty-a", "$ ls\r\n");
    detach();
    emit("pty-a", "file.txt\r\n");

    const replayed: string[] = [];
    const live: string[] = [];
    attachPtyOutput(
      ptyId,
      (data) => replayed.push(data),
      (data) => live.push(data),
    );
    emit("pty-a", "$ ");

    expect(first).toEqual(["$ ls\r\n"]);
    expect(replayed).toEqual(["$ ls\r\nfile.txt\r\n"]);
    expect(live).toEqual(["$ "]);
  });

  it("keeps the prompt printed before the PTY id was known", async () => {
    const ptyId = await startPty(() => {
      emit("pty-b", "prompt> ");
      return Promise.resolve("pty-b");
    });
    const replayed: string[] = [];
    attachPtyOutput(
      ptyId,
      (data) => replayed.push(data),
      () => {},
    );

    expect(replayed).toEqual(["prompt> "]);
  });

  it("ignores output of PTYs it does not record", () => {
    emit("pty-other", "noise");
    const replayed: string[] = [];
    attachPtyOutput(
      "pty-other",
      (data) => replayed.push(data),
      () => {},
    );

    expect(replayed).toEqual([]);
  });

  it("forgets a released PTY", async () => {
    const ptyId = await startPty(() => Promise.resolve("pty-c"));
    emit("pty-c", "old");
    releasePtyOutput(ptyId);
    const replayed: string[] = [];
    attachPtyOutput(
      ptyId,
      (data) => replayed.push(data),
      () => {},
    );

    expect(replayed).toEqual([]);
  });
});
