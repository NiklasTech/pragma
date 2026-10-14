import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { listenMock, invokeMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import {
  cancelTerminal,
  disposeTerminal,
  ensureTerminal,
  subscribeTerminalAttention,
  writeTerminal,
  type TerminalAttentionKind,
} from "./runner";

type Handler = (event: { payload: { id: string; data?: string; exit_code?: number } }) => void;

const handlers = new Map<string, Handler>();
let ptyCounter = 0;

function output(ptyId: string, data: string): void {
  handlers.get("pty_output")?.({ payload: { id: ptyId, data } });
}

function exit(ptyId: string, exitCode: number): void {
  handlers.get("pty_exit")?.({ payload: { id: ptyId, exit_code: exitCode } });
}

async function start(sessionId: string): Promise<string> {
  await ensureTerminal(sessionId, { command: "claude", cwd: null, cols: 80, rows: 24 });
  return `pty-${ptyCounter}`;
}

listenMock.mockImplementation((event: string, handler: Handler) => {
  handlers.set(event, handler);
  return Promise.resolve(() => {});
});

describe("terminal attention", () => {
  let events: Array<[string, TerminalAttentionKind]>;
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    invokeMock.mockImplementation((command: string) => {
      if (command !== "create_pty_command") return Promise.resolve();
      ptyCounter += 1;
      return Promise.resolve(`pty-${ptyCounter}`);
    });
    events = [];
    unsubscribe = subscribeTerminalAttention((sessionId, kind) => events.push([sessionId, kind]));
  });

  afterEach(() => {
    unsubscribe();
    disposeTerminal("session");
    vi.useRealTimers();
  });

  it("reports a bell and an OSC 9 notification", async () => {
    const ptyId = await start("session");
    output(ptyId, "\x1b]9;Agent turn complete\x07");
    vi.advanceTimersByTime(5000);
    output(ptyId, "\x07");
    expect(events).toEqual([
      ["session", "finished"],
      ["session", "input"],
    ]);
  });

  it("reports one event when a CLI signals twice in a row", async () => {
    const ptyId = await start("session");
    output(ptyId, "\x1b]777;notify;Pragma;finished\x07");
    output(ptyId, "\x07");
    expect(events).toEqual([["session", "finished"]]);
  });

  it("ignores the echo of the user's typing", async () => {
    const ptyId = await start("session");
    await writeTerminal("session", "\t");
    output(ptyId, "\x07");
    expect(events).toEqual([]);
  });

  it("reports a non-zero exit as failed", async () => {
    const ptyId = await start("session");
    exit(ptyId, 1);
    expect(events).toEqual([["session", "failed"]]);
  });

  it("stays quiet for a clean exit and a cancelled run", async () => {
    const ptyId = await start("session");
    exit(ptyId, 0);
    disposeTerminal("session");
    const nextPtyId = await start("session");
    cancelTerminal("session");
    exit(nextPtyId, 137);
    expect(events).toEqual([]);
  });
});
