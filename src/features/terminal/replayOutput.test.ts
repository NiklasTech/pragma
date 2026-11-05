import { describe, expect, it } from "vite-plus/test";

import { replayWithoutReplies } from "./replayOutput";

describe("replayWithoutReplies", () => {
  it("blocks replies until the replay is parsed, then accepts input again", () => {
    let parsed: (() => void) | undefined;
    const written: string[] = [];
    const term = {
      options: { disableStdin: false },
      write: (data: string | Uint8Array, callback?: () => void) => {
        written.push(String(data));
        parsed = callback;
      },
    };

    replayWithoutReplies(term, "\x1b[6n");

    expect(written).toEqual(["\x1b[6n"]);
    expect(term.options.disableStdin).toBe(true);
    parsed?.();
    expect(term.options.disableStdin).toBe(false);
  });
});
