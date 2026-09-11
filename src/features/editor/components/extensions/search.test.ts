import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import { getSearchQuery, searchPanelOpen, SearchQuery } from "@codemirror/search";

import { searchPanelOverlayTheme } from "@/shared/lib/theme/editor-theme";
import { searchExtension } from "./search";
import {
  PragmaSearchPanel,
  type PragmaSearchPanelLabels,
  type PragmaSearchPanelOptions,
} from "./search-panel";

class FakeNode {
  readonly tagName: string;
  readonly children: FakeNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  className = "";
  textContent = "";
  hidden = false;
  value = "";
  checked = false;
  type = "";
  name = "";
  title = "";
  placeholder = "";
  tabIndex = 0;
  focused = false;
  selected = false;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get classList(): {
    add: (token: string) => void;
    remove: (token: string) => void;
    contains: (token: string) => boolean;
    toggle: (token: string, force?: boolean) => boolean;
  } {
    const tokens = () => this.className.split(" ").filter(Boolean);
    return {
      add: (token: string) => {
        if (!tokens().includes(token)) {
          this.className = [...tokens(), token].join(" ");
        }
      },
      remove: (token: string) => {
        this.className = tokens()
          .filter((entry) => entry !== token)
          .join(" ");
      },
      contains: (token: string) => tokens().includes(token),
      toggle: (token: string, force?: boolean) => {
        const next = force ?? !tokens().includes(token);
        if (next) {
          this.className = [...tokens(), token].join(" ");
        } else {
          this.className = tokens()
            .filter((entry) => entry !== token)
            .join(" ");
        }
        return next;
      },
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: FakeNode): FakeNode {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  focus(): void {
    this.focused = true;
  }

  select(): void {
    this.selected = true;
  }
}

class FakeDocument {
  createElement(tagName: string): FakeNode {
    return new FakeNode(tagName);
  }

  createElementNS(tagName: string): FakeNode {
    return new FakeNode(tagName);
  }
}

const defaultLabels: PragmaSearchPanelLabels = {
  find: "Find",
  replace: "Replace",
  next: "next",
  previous: "previous",
  matchCase: "match case",
  regexp: "regexp",
  byWord: "by word",
  close: "close",
  replaceNext: "replace",
  replaceAll: "replace all",
  toggleReplace: "replace",
};

function findNamed(node: FakeNode, name: string): FakeNode | undefined {
  if (node.name === name) return node;
  for (const child of node.children) {
    const match = findNamed(child, name);
    if (match) return match;
  }
  return undefined;
}

function createPanel(overrides: Partial<PragmaSearchPanelOptions> = {}): {
  panel: PragmaSearchPanel;
  root: FakeNode;
} {
  const panel = new PragmaSearchPanel(new FakeDocument() as unknown as Document, {
    query: new SearchQuery({ search: "" }),
    readOnly: false,
    labels: defaultLabels,
    onChange: () => {},
    onFindNext: () => {},
    onFindPrevious: () => {},
    onReplaceNext: () => {},
    onReplaceAll: () => {},
    onClose: () => {},
    ...overrides,
  });
  return { panel, root: panel.dom as unknown as FakeNode };
}

describe("PragmaSearchPanel", () => {
  it("renders the find row with the query field and controls", () => {
    const { root } = createPanel();
    expect(root.classList.contains("cm-search")).toBe(true);
    expect(findNamed(root, "search")?.getAttribute("main-field")).toBe("true");
    expect(findNamed(root, "prev")).toBeDefined();
    expect(findNamed(root, "next")).toBeDefined();
    expect(findNamed(root, "close-search")).toBeDefined();
    expect(findNamed(root, "toggle-case")).toBeDefined();
    expect(findNamed(root, "toggle-word")).toBeDefined();
    expect(findNamed(root, "toggle-regexp")).toBeDefined();
  });

  it("keeps the replace row collapsed until it is expanded", () => {
    const { panel, root } = createPanel();
    expect(panel.replaceOpen).toBe(false);
    expect(panel.replaceRow?.hidden).toBe(true);
    expect(findNamed(root, "replace")).toBeDefined();
    expect(findNamed(root, "replaceAll")).toBeDefined();

    panel.setReplaceOpen(true);
    expect(panel.replaceOpen).toBe(true);
    expect(findNamed(root, "toggle-replace")?.getAttribute("aria-expanded")).toBe("true");

    panel.setReplaceOpen(false);
    expect(panel.replaceOpen).toBe(false);
  });

  it("omits replace controls in read-only editors", () => {
    const { panel, root } = createPanel({ readOnly: true });
    expect(panel.replaceRow).toBeNull();
    expect(panel.replaceField).toBeNull();
    expect(findNamed(root, "toggle-replace")).toBeUndefined();
    expect(findNamed(root, "replace")).toBeUndefined();
  });

  it("applies an editor query to the fields and option toggles", () => {
    const { panel, root } = createPanel();
    panel.setQuery(
      new SearchQuery({
        search: "needle",
        replace: "thread",
        caseSensitive: true,
        regexp: true,
        wholeWord: true,
      }),
    );
    expect(panel.searchField.value).toBe("needle");
    expect(panel.replaceField?.value).toBe("thread");
    expect(findNamed(root, "toggle-case")?.getAttribute("aria-pressed")).toBe("true");
    expect(findNamed(root, "toggle-word")?.getAttribute("aria-pressed")).toBe("true");
    expect(findNamed(root, "toggle-regexp")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("focuses and selects the requested field", () => {
    const { panel } = createPanel();
    panel.focusSearch();
    expect((panel.searchField as unknown as FakeNode).focused).toBe(true);
    expect((panel.searchField as unknown as FakeNode).selected).toBe(true);

    panel.focusReplace();
    expect((panel.replaceField as unknown as FakeNode).focused).toBe(true);
    expect((panel.replaceField as unknown as FakeNode).selected).toBe(true);
  });

  it("commits typed text and option toggles as a search query", () => {
    const queries: SearchQuery[] = [];
    const { panel, root } = createPanel({ onChange: (query) => queries.push(query) });

    const searchField = panel.searchField as unknown as FakeNode;
    searchField.value = "needle";
    searchField.dispatch("input");
    expect(queries[queries.length - 1]?.search).toBe("needle");

    findNamed(root, "toggle-case")?.dispatch("click");
    expect(queries[queries.length - 1]?.caseSensitive).toBe(true);
    expect(findNamed(root, "toggle-case")?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("searchExtension", () => {
  it("registers search state without opening the panel", () => {
    const state = EditorState.create({ doc: "hello world", extensions: [searchExtension()] });
    expect(searchPanelOpen(state)).toBe(false);
    expect(getSearchQuery(state).search).toBe("");
  });
});

describe("search panel overlay", () => {
  it("floats the panel container instead of keeping it in flow", () => {
    const container = searchPanelOverlayTheme["& .cm-panels.cm-panels-top"];
    expect(container.position).toBe("absolute");
    expect(container.pointerEvents).toBe("none");
    expect(container.width).toContain("calc(100% - 24px)");
    expect(searchPanelOverlayTheme["& .cm-panel.cm-search"].pointerEvents).toBe("auto");
  });
});
