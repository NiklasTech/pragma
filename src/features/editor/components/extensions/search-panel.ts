import { SearchQuery } from "@codemirror/search";
import type { Panel } from "@codemirror/view";

const SVG_NS = "http://www.w3.org/2000/svg";

const CARET_UP =
  "M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z";
const CARET_DOWN =
  "M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z";
const CARET_RIGHT =
  "M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z";
const X_ICON =
  "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z";

const PANEL_CLASS =
  "cm-search pragma-search flex w-full flex-col gap-1.5 rounded-xl border border-border/60 bg-bg-elevated p-1.5 text-fg-default shadow-xl shadow-black/15";
const ROW_CLASS = "flex items-center gap-1";
const INPUT_CLASS =
  "h-7 min-w-0 flex-1 rounded-md border border-border bg-bg-input px-2.5 py-1 text-ui-base text-fg-default outline-none transition-all duration-200 placeholder:text-fg-subtle focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:bg-bg-elevated";
const GHOST_BUTTON_CLASS =
  "flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default";
const TOGGLE_CLASS =
  "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-ui-xs font-medium text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default aria-pressed:bg-accent-subtle aria-pressed:text-primary";
const TEXT_BUTTON_CLASS =
  "flex h-7 shrink-0 items-center rounded-md border border-border/60 bg-transparent px-2 text-ui-xs font-medium text-fg-default transition-colors hover:bg-bg-hover";

export interface PragmaSearchPanelLabels {
  find: string;
  replace: string;
  next: string;
  previous: string;
  matchCase: string;
  regexp: string;
  byWord: string;
  close: string;
  replaceNext: string;
  replaceAll: string;
  toggleReplace: string;
}

export interface PragmaSearchPanelOptions {
  query: SearchQuery;
  readOnly: boolean;
  labels: PragmaSearchPanelLabels;
  onChange: (query: SearchQuery) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplaceNext: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export class PragmaSearchPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  readonly searchField: HTMLInputElement;
  readonly replaceField: HTMLInputElement | null;
  readonly replaceRow: HTMLElement | null;

  private readonly replaceToggle: HTMLButtonElement | null;
  private readonly options: PragmaSearchPanelOptions;
  private readonly toggles: { read: () => boolean; button: HTMLButtonElement }[] = [];
  private query: SearchQuery;
  private caseSensitive: boolean;
  private regexp: boolean;
  private wholeWord: boolean;

  constructor(doc: Document, options: PragmaSearchPanelOptions) {
    this.options = options;
    this.query = options.query;
    this.caseSensitive = options.query.caseSensitive;
    this.regexp = options.query.regexp;
    this.wholeWord = options.query.wholeWord;

    this.searchField = createInput(doc, "search", options.labels.find, options.query.search);
    this.searchField.setAttribute("main-field", "true");
    this.searchField.addEventListener("input", () => this.commit());
    this.searchField.addEventListener("change", () => this.commit());

    const findRow = doc.createElement("div");
    findRow.className = ROW_CLASS;

    this.replaceToggle = options.readOnly
      ? null
      : createGhostButton(doc, "toggle-replace", options.labels.toggleReplace, CARET_RIGHT);
    if (this.replaceToggle) {
      this.replaceToggle.classList.add("pragma-search-replace-toggle");
      this.replaceToggle.setAttribute("aria-expanded", "false");
      this.replaceToggle.addEventListener("click", () => {
        this.setReplaceOpen(!this.replaceOpen);
      });
      findRow.appendChild(this.replaceToggle);
    }

    findRow.appendChild(this.searchField);
    findRow.appendChild(
      this.createToggle(
        doc,
        "toggle-case",
        options.labels.matchCase,
        "Aa",
        () => this.caseSensitive,
        (value) => {
          this.caseSensitive = value;
        },
      ),
    );
    findRow.appendChild(
      this.createToggle(
        doc,
        "toggle-word",
        options.labels.byWord,
        "Ab",
        () => this.wholeWord,
        (value) => {
          this.wholeWord = value;
        },
      ),
    );
    findRow.appendChild(
      this.createToggle(
        doc,
        "toggle-regexp",
        options.labels.regexp,
        ".*",
        () => this.regexp,
        (value) => {
          this.regexp = value;
        },
      ),
    );

    const previousButton = createGhostButton(doc, "prev", options.labels.previous, CARET_UP);
    previousButton.addEventListener("click", () => this.options.onFindPrevious());
    findRow.appendChild(previousButton);

    const nextButton = createGhostButton(doc, "next", options.labels.next, CARET_DOWN);
    nextButton.addEventListener("click", () => this.options.onFindNext());
    findRow.appendChild(nextButton);

    const closeButton = createGhostButton(doc, "close-search", options.labels.close, X_ICON);
    closeButton.addEventListener("click", () => this.options.onClose());
    findRow.appendChild(closeButton);

    const root = doc.createElement("div");
    root.className = PANEL_CLASS;
    root.appendChild(findRow);

    if (options.readOnly) {
      this.replaceField = null;
      this.replaceRow = null;
    } else {
      const replaceField = createInput(
        doc,
        "replace",
        options.labels.replace,
        options.query.replace,
      );
      replaceField.addEventListener("input", () => this.commit());
      replaceField.addEventListener("change", () => this.commit());

      const replaceRow = doc.createElement("div");
      replaceRow.className = ROW_CLASS;
      replaceRow.hidden = true;
      replaceRow.appendChild(replaceField);

      const replaceButton = createTextButton(
        doc,
        "replace",
        options.labels.replaceNext,
        TEXT_BUTTON_CLASS,
      );
      replaceButton.addEventListener("click", () => this.options.onReplaceNext());
      replaceRow.appendChild(replaceButton);

      const replaceAllButton = createTextButton(
        doc,
        "replaceAll",
        options.labels.replaceAll,
        TEXT_BUTTON_CLASS,
      );
      replaceAllButton.addEventListener("click", () => this.options.onReplaceAll());
      replaceRow.appendChild(replaceAllButton);

      this.replaceField = replaceField;
      this.replaceRow = replaceRow;
      root.appendChild(replaceRow);
    }

    this.dom = root;
  }

  get replaceOpen(): boolean {
    return this.replaceRow ? !this.replaceRow.hidden : false;
  }

  setReplaceOpen(open: boolean): void {
    if (!this.replaceRow) return;
    this.replaceRow.hidden = !open;
    this.replaceToggle?.setAttribute("aria-expanded", String(open));
  }

  setQuery(query: SearchQuery): void {
    this.query = query;
    this.searchField.value = query.search;
    if (this.replaceField) {
      this.replaceField.value = query.replace;
    }
    this.caseSensitive = query.caseSensitive;
    this.regexp = query.regexp;
    this.wholeWord = query.wholeWord;
    this.syncToggles();
  }

  focusSearch(): void {
    this.searchField.focus();
    this.searchField.select();
  }

  focusReplace(): void {
    if (!this.replaceField) return;
    this.replaceField.focus();
    this.replaceField.select();
  }

  private commit(): void {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseSensitive,
      regexp: this.regexp,
      wholeWord: this.wholeWord,
      replace: this.replaceField?.value ?? this.query.replace,
    });
    if (query.eq(this.query)) return;
    this.query = query;
    this.options.onChange(query);
  }

  private syncToggles(): void {
    for (const { read, button } of this.toggles) {
      button.setAttribute("aria-pressed", String(read()));
    }
  }

  private createToggle(
    doc: Document,
    name: string,
    label: string,
    text: string,
    read: () => boolean,
    write: (value: boolean) => void,
  ): HTMLButtonElement {
    const button = doc.createElement("button");
    button.type = "button";
    button.name = name;
    button.className = TOGGLE_CLASS;
    button.textContent = text;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(read()));
    button.addEventListener("click", () => {
      write(!read());
      button.setAttribute("aria-pressed", String(read()));
      this.commit();
    });
    this.toggles.push({ read, button });
    return button;
  }
}

function createInput(doc: Document, name: string, label: string, value: string): HTMLInputElement {
  const input = doc.createElement("input");
  input.type = "text";
  input.name = name;
  input.className = INPUT_CLASS;
  input.value = value;
  input.placeholder = label;
  input.setAttribute("aria-label", label);
  input.setAttribute("spellcheck", "false");
  input.setAttribute("autocomplete", "off");
  return input;
}

function createGhostButton(
  doc: Document,
  name: string,
  label: string,
  path: string,
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.name = name;
  button.className = GHOST_BUTTON_CLASS;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.appendChild(createIcon(doc, path));
  return button;
}

function createTextButton(
  doc: Document,
  name: string,
  label: string,
  className: string,
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.name = name;
  button.className = className;
  button.textContent = label;
  return button;
}

function createIcon(doc: Document, path: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 256 256");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const node = doc.createElementNS(SVG_NS, "path");
  node.setAttribute("d", path);
  svg.appendChild(node);
  return svg;
}
