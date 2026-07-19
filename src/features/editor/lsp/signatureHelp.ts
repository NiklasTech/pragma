import {
  EditorView,
  ViewPlugin,
  keymap,
  showTooltip,
  type Tooltip,
  type ViewUpdate,
} from "@codemirror/view";
import { StateEffect, StateField, type Extension } from "@codemirror/state";

import { lspSignatureHelp, type LspSignatureHelp } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { positionToLsp } from "./definition";
import { renderMarkdownToDom } from "./markdown-lite";

export function splitActiveParameter(
  signatureLabel: string,
  parameterLabel: string,
): [string, string, string] | null {
  if (parameterLabel.length === 0) {
    return null;
  }
  const index = signatureLabel.indexOf(parameterLabel);
  if (index === -1) {
    return null;
  }
  return [
    signatureLabel.slice(0, index),
    parameterLabel,
    signatureLabel.slice(index + parameterLabel.length),
  ];
}

const setSignatureTooltip = StateEffect.define<Tooltip | null>();

const signatureTooltipField = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSignatureTooltip)) {
        return effect.value;
      }
    }
    return value;
  },
  provide: (field) => showTooltip.from(field),
});

function buildTooltipDom(help: LspSignatureHelp): HTMLElement {
  const root = document.createElement("div");
  root.className = "cm-lsp-signature-help";

  const signature = help.signatures[Math.min(help.activeSignature, help.signatures.length - 1)];
  const labelRow = document.createElement("div");
  labelRow.className = "cm-lsp-signature-label";

  const activeParameter = signature.parameters[help.activeParameter]?.label ?? "";
  const parts = splitActiveParameter(signature.label, activeParameter);
  if (parts) {
    const [before, active, after] = parts;
    labelRow.appendChild(document.createTextNode(before));
    const activeSpan = document.createElement("span");
    activeSpan.className = "cm-lsp-signature-active";
    activeSpan.textContent = active;
    labelRow.appendChild(activeSpan);
    labelRow.appendChild(document.createTextNode(after));
  } else {
    labelRow.textContent = signature.label;
  }
  root.appendChild(labelRow);

  if (help.signatures.length > 1) {
    const counter = document.createElement("span");
    counter.className = "cm-lsp-signature-counter";
    counter.textContent = `${help.activeSignature + 1}/${help.signatures.length}`;
    labelRow.appendChild(counter);
  }

  if (signature.documentation) {
    const docs = renderMarkdownToDom(signature.documentation);
    docs.classList.add("cm-lsp-signature-doc");
    root.appendChild(docs);
  }

  return root;
}

class SignatureHelpPlugin {
  private requestSeq = 0;

  constructor(
    private readonly view: EditorView,
    private readonly language: string,
    private readonly filePath: string,
    private readonly triggerCharacters: string[],
  ) {}

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      let triggered = false;
      update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
        const text = inserted.sliceString(0);
        const lastChar = text[text.length - 1];
        if (lastChar && this.triggerCharacters.includes(lastChar)) {
          triggered = true;
        }
      });
      if (triggered) {
        void this.requestHelp();
      }
      return;
    }

    if (update.selectionSet && this.view.state.field(signatureTooltipField)) {
      this.close();
    }
  }

  destroy(): void {
    this.requestSeq += 1;
  }

  private close(): void {
    this.requestSeq += 1;
    this.view.dispatch({ effects: setSignatureTooltip.of(null) });
  }

  private async requestHelp(): Promise<void> {
    const seq = ++this.requestSeq;
    const state = this.view.state;
    const pos = state.selection.main.head;
    const { line, character } = positionToLsp(state.doc, pos);

    await flushLspDocumentSync(this.language, this.filePath, state.doc.toString()).catch(() => {});

    let help: LspSignatureHelp | null = null;
    try {
      help = await lspSignatureHelp(this.language, this.filePath, line, character);
    } catch {
      help = null;
    }

    if (seq !== this.requestSeq) {
      return;
    }
    if (!help) {
      this.close();
      return;
    }

    this.view.dispatch({
      effects: setSignatureTooltip.of({
        pos,
        above: true,
        create: () => ({ dom: buildTooltipDom(help) }),
      }),
    });
  }
}

export function signatureHelpExtension(
  language: string,
  filePath: string,
  triggerCharacters: string[],
): Extension {
  if (triggerCharacters.length === 0) {
    return [];
  }
  return [
    signatureTooltipField,
    ViewPlugin.define(
      (view) => new SignatureHelpPlugin(view, language, filePath, triggerCharacters),
    ),
    keymap.of([
      {
        key: "Escape",
        run: (view) => {
          if (!view.state.field(signatureTooltipField)) {
            return false;
          }
          view.dispatch({ effects: setSignatureTooltip.of(null) });
          return true;
        },
      },
    ]),
  ];
}
