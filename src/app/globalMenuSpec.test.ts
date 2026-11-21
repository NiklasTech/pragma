import { describe, expect, it } from "vite-plus/test";

import { buildMenu, quoteMarkdown } from "./globalMenuSpec";

const noop = () => {};
const actions = {
  editWithAI: noop,
  goToDefinition: noop,
  findReferences: noop,
  rename: noop,
  quickFix: noop,
  formatDocument: noop,
  cut: noop,
  copy: noop,
  paste: noop,
  selectAll: noop,
  quote: noop,
  clearTerminal: noop,
  acceptSuggestion: noop,
  dismissSuggestion: noop,
};
const lsp = {
  canGoToDefinition: false,
  canFindReferences: false,
  canRename: false,
  canQuickFix: false,
  canFormatDocument: false,
};

function labels(menu: ReturnType<typeof buildMenu>): string[] {
  return menu.groups.flatMap((group) => group.items.map((item) => item.label));
}

describe("global menu", () => {
  it("quotes a selection as Markdown", () => {
    expect(quoteMarkdown("one\ntwo\n")).toBe("> one\n> two\n\n");
  });

  it("offers a quote only for text selected in a chat", () => {
    const base = {
      hasSelection: true,
      activeTabName: null,
      lsp,
      terminalSuggestion: false,
      actions,
    };
    const menu = { contextType: "selection" as const, selection: "hi" };

    expect(labels(buildMenu({ ...base, menu, inChat: true }))).toEqual(["copy", "quote in reply"]);
    expect(labels(buildMenu({ ...base, menu, inChat: false }))).toEqual(["copy"]);
  });

  it("disables code actions the language server cannot run and copy without a selection", () => {
    const menu = buildMenu({
      menu: { contextType: "editor", selection: "" },
      hasSelection: false,
      inChat: false,
      activeTabName: "main.ts",
      lsp,
      terminalSuggestion: false,
      actions,
    });
    const items = menu.groups.flatMap((group) => group.items);
    expect(menu.head).toBe("main.ts");
    expect(items.find((item) => item.label === "go to definition")?.disabled).toBe(true);
    expect(items.find((item) => item.label === "copy")?.disabled).toBe(true);
    expect(items.find((item) => item.label === "paste")?.disabled).toBeFalsy();
  });
});
