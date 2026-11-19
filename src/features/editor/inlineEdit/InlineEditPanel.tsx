import type { EditorView } from "@codemirror/view";
import { openSettings } from "@/features/settings/openSettings";
import { useShallow } from "zustand/react/shallow";
import { Sparkle, Spinner } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Kbd } from "@/shared/components/ui/kbd";
import { getIsMac } from "@/shared/lib/shortcuts";
import { useAIStore } from "@/shared/stores/ai";

import { acceptInlineEdit, closeInlineEdit } from "./inlineEdit";
import { useInlineEditStore } from "./inlineEditStore";
import { inlineEditModel } from "./inlineEditText";
import { makeInlineEditTask, requestInlineEdit, taskAgent } from "./runInlineEdit";

const MOD = getIsMac() ? "⌘" : "Ctrl+";

/// The instruction field over the lines under review, and what came of it.
export function InlineEditPanel({ view, id }: { view: EditorView; id: number }) {
  const active = useInlineEditStore((state) => state.id === id);
  const instruction = useInlineEditStore((state) => state.instruction);
  const setInstruction = useInlineEditStore((state) => state.setInstruction);
  const phase = useInlineEditStore((state) => state.phase);
  const model = useAIStore(useShallow((state) => inlineEditModel(state)));
  const agent = useAIStore(() => taskAgent());
  if (!active) return null;

  const close = () => closeInlineEdit(view);
  const run = () => void requestInlineEdit(view, id);
  const toTask = () => void makeInlineEditTask(view, id);
  const hasInstruction = instruction.trim() !== "";

  return (
    <div
      role="group"
      aria-label="Edit with AI"
      className="flex max-w-[680px] flex-col gap-2 rounded-[11px] bg-bg-sheet py-2 pr-2 pl-3 font-sans shadow-[var(--shadow-md)] ring-1 ring-border ring-inset"
    >
      <div className="flex items-center gap-2">
        <Sparkle size={14} aria-hidden="true" className="shrink-0 text-fg-muted" />
        <Input
          autoFocus
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (phase.kind === "result") acceptInlineEdit(view);
            } else if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (model) run();
              else if (agent) toTask();
            }
          }}
          placeholder="What should change?"
          aria-label="Instruction"
          className="h-7 min-w-0 flex-1 bg-transparent px-0 text-ui-sm ring-0 hover:ring-0 focus-visible:ring-0"
        />
        {model && (
          <span
            className="flex h-6 max-w-[200px] shrink-0 items-center rounded-[6px] bg-bg-hover px-2 text-ui-xs text-fg-muted"
            title={`${model.provider} · ${model.model}`}
          >
            <span className="truncate">{model.model}</span>
          </span>
        )}
      </div>

      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        {!model ? (
          <span className="min-w-48 flex-1 text-ui-xs text-fg-muted">
            Inline edits use a model. Add an API key in Settings, or hand it to an agent as a task.
          </span>
        ) : phase.kind === "working" ? (
          <span className="flex min-w-48 flex-1 items-center gap-2 text-ui-xs text-fg-muted">
            <Spinner
              size={12}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Rewriting with {model.model}
          </span>
        ) : phase.kind === "result" ? (
          <span className="min-w-48 flex-1 text-ui-xs text-fg-muted">{phase.summary}</span>
        ) : phase.kind === "error" ? (
          <span
            className="min-w-48 flex-1 truncate text-ui-xs text-status-error"
            title={phase.message}
          >
            {phase.message}
          </span>
        ) : (
          <span className="min-w-48 flex-1 text-ui-xs text-fg-subtle">
            Enter rewrites the selected lines
          </span>
        )}

        {!model && (
          <Button variant="ghost" size="sm" onClick={() => openSettings("editor", "Models")}>
            Open settings
          </Button>
        )}
        {agent && (
          <Button variant="ghost" size="sm" disabled={!hasInstruction} onClick={toTask}>
            Make it a task
          </Button>
        )}
        {phase.kind === "result" ? (
          <>
            <Button variant="ghost" size="sm" onClick={close}>
              Reject <Kbd>Esc</Kbd>
            </Button>
            <Button size="sm" onClick={() => acceptInlineEdit(view)}>
              Accept <Kbd className="border-0 bg-black/10 text-current">{MOD}⏎</Kbd>
            </Button>
          </>
        ) : (
          model && (
            <Button size="sm" disabled={!hasInstruction || phase.kind === "working"} onClick={run}>
              {phase.kind === "error" ? "Try again" : "Edit"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
