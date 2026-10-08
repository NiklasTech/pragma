import { useEffect, useRef, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { useDebugStore } from "../store";
import { navigateConsoleHistory, type ConsoleEntryKind } from "../debugConsole";
import { SectionLabel, ToolbarButton } from "./DebugPanelParts";

const ENTRY_STYLES: Record<ConsoleEntryKind, string> = {
  input: "text-fg-muted",
  result: "text-fg-default",
  error: "text-status-error",
  stdout: "text-fg-default",
  stderr: "text-status-error",
};

export function DebugConsoleSection() {
  const entries = useDebugStore((state) => state.consoleEntries);
  const history = useDebugStore((state) => state.consoleHistory);
  const isRunning = useDebugStore((state) => state.status === "running");
  const evaluateInConsole = useDebugStore((state) => state.evaluateInConsole);
  const clearConsole = useDebugStore((state) => state.clearConsole);
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries]);

  const submit = () => {
    if (!input.trim()) return;
    void evaluateInConsole(input);
    setInput("");
    setHistoryIndex(null);
  };

  const navigate = (direction: "up" | "down") => {
    const next = navigateConsoleHistory(history, historyIndex, direction);
    setHistoryIndex(next.index);
    setInput(next.value);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel title="Debug Console" />
        <ToolbarButton
          icon={Trash}
          title="Clear console"
          disabled={entries.length === 0}
          onClick={clearConsole}
        />
      </div>
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto rounded-md border border-border bg-bg-surface px-2 py-1 font-mono text-ui-xs"
      >
        {entries.length === 0 ? (
          <div className="py-1 text-fg-subtle">
            Program output and evaluation results appear here.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={cn("whitespace-pre-wrap break-all", ENTRY_STYLES[entry.kind])}
            >
              {entry.kind === "input" ? `> ${entry.text}` : entry.text.replace(/\n$/, "")}
            </div>
          ))
        )}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setHistoryIndex(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            navigate("up");
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            navigate("down");
          }
        }}
        disabled={!isRunning}
        placeholder={
          isRunning ? "Evaluate in the selected frame" : "Start a debug session to evaluate"
        }
        className="h-6 w-full rounded-md border border-border bg-bg-surface px-2 font-mono text-ui-xs text-fg-default outline-none placeholder:text-fg-subtle focus:border-primary/50 disabled:opacity-40"
      />
    </div>
  );
}
