import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { externalUpdate } from "@/features/editor/compartments";

const DOC_SYNC_DELAY_MS = 150;

const pendingFlushes = new Set<() => void>();

// Writes every debounced editor change to its tab right away, e.g. before a save reads the store.
export function flushPendingDocChanges(): void {
  for (const flush of pendingFlushes) flush();
}

// Reports user edits as the full document text, debounced so typing does not serialize it per keystroke.
export function docSyncExtension(onChange: (value: string) => void) {
  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;

      constructor(private readonly view: EditorView) {}

      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        const isExternal = update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(externalUpdate)),
        );
        if (isExternal) {
          this.cancel();
          return;
        }
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = setTimeout(this.flush, DOC_SYNC_DELAY_MS);
        pendingFlushes.add(this.flush);
      }

      destroy() {
        this.flush();
      }

      private readonly flush = () => {
        if (this.timer === null) return;
        this.cancel();
        onChange(this.view.state.doc.toString());
      };

      private cancel() {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        pendingFlushes.delete(this.flush);
      }
    },
  );
}
