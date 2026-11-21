import { describe, expect, it, vi } from "vite-plus/test";

import { messageMenu } from "./messageMenu";

function actions() {
  return { copy: vi.fn(), quote: vi.fn(), copyMessage: vi.fn(), fork: vi.fn(), rewind: vi.fn() };
}

function labels(menu: ReturnType<typeof messageMenu>): string[] {
  return menu.groups.flatMap((group) => group.items.map((item) => item.label));
}

describe("messageMenu", () => {
  it("offers the selected text first, then the whole reply", () => {
    const run = actions();
    const menu = messageMenu({
      selection: " some text ",
      canFork: true,
      canRewind: true,
      actions: run,
    });
    expect(labels(menu)).toEqual([
      "copy",
      "quote in reply",
      "copy message",
      "fork from here",
      "rewind to here",
    ]);
    menu.groups[0].items[1].onSelect();
    expect(run.quote).toHaveBeenCalledWith("some text");
  });

  it("leaves out what a busy or last reply cannot do", () => {
    const menu = messageMenu({
      selection: "",
      canFork: false,
      canRewind: false,
      actions: actions(),
    });
    expect(labels(menu)).toEqual(["copy message"]);
  });
});
