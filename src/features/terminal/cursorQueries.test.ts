import { describe, expect, it } from "vite-plus/test";

import { createOutputWriter, isCursorQueryOnly } from "./cursorQueries";

function fakeTerminal(cursorX: number, cursorY: number) {
  const writes: { data: string; parsed?: () => void }[] = [];
  return {
    writes,
    term: {
      options: { disableStdin: false },
      buffer: { active: { cursorX, cursorY } },
      write: (data: string, parsed?: () => void) => {
        writes.push({ data, parsed });
      },
    },
  };
}

function setup(cursorX = 4, cursorY = 9) {
  const fake = fakeTerminal(cursorX, cursorY);
  const replies: string[] = [];
  const write = createOutputWriter(fake.term, (data) => replies.push(data));
  return { ...fake, replies, write };
}

describe("createOutputWriter", () => {
  it("answers cursor queries itself without writing to xterm", () => {
    const { writes, replies, write } = setup();

    write("\x1b[?6n");
    write("\x1b[6n\x1b[?6n");

    expect(writes).toEqual([]);
    expect(replies).toEqual(["\x1b[?10;5R", "\x1b[10;5R\x1b[?10;5R"]);
  });

  it("tells when a write is parsed", () => {
    const { writes, write } = setup();
    let parsed = false;
    write("hello", () => {
      parsed = true;
    });
    expect(parsed).toBe(false);
    writes[0].parsed?.();
    expect(parsed).toBe(true);
  });

  it("writes everything else to xterm", () => {
    const { writes, replies, write } = setup();

    write("hello\x1b[?6n");

    expect(writes.map((entry) => entry.data)).toEqual(["hello\x1b[?6n"]);
    expect(replies).toEqual([]);
  });

  it("lets xterm answer while earlier output is still being parsed", () => {
    const { writes, replies, write } = setup();

    write("hello");
    write("\x1b[?6n");
    expect(writes.map((entry) => entry.data)).toEqual(["hello", "\x1b[?6n"]);

    writes[0].parsed?.();
    writes[1].parsed?.();
    write("\x1b[?6n");
    expect(replies).toEqual(["\x1b[?10;5R"]);
  });

  it("leaves queries to xterm while input is disabled for a replay", () => {
    const { term, writes, replies, write } = setup();
    term.options.disableStdin = true;

    write("\x1b[?6n");

    expect(writes.map((entry) => entry.data)).toEqual(["\x1b[?6n"]);
    expect(replies).toEqual([]);
  });
});

describe("isCursorQueryOnly", () => {
  it("matches only output made of cursor position queries", () => {
    expect(isCursorQueryOnly("\x1b[?6n\x1b[6n")).toBe(true);
    expect(isCursorQueryOnly("\x1b[5n")).toBe(false);
    expect(isCursorQueryOnly("x\x1b[6n")).toBe(false);
    expect(isCursorQueryOnly("")).toBe(false);
  });
});
