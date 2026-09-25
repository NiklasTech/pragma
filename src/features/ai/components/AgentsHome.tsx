"use client";

import { useCallback, useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { homePromptLabel, isHomePromptSubmitKey, trimHomePrompt } from "../home/homePrompt";
import { clearPendingFirstMessage, setPendingFirstMessage } from "../home/pendingFirstMessage";

export function AgentsHome() {
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const createChatSession = useAIStore((state) => state.createChatSession);

  const startThread = useCallback(async () => {
    if (!rootPath || creating) return;

    setCreating(true);
    setError(null);

    const text = trimHomePrompt(prompt);
    if (text) {
      setPendingFirstMessage(text);
    } else {
      clearPendingFirstMessage();
    }

    try {
      await createChatSession(rootPath);
      setPrompt("");
    } catch {
      clearPendingFirstMessage();
      setError("Could not start the thread.");
    } finally {
      setCreating(false);
    }
  }, [createChatSession, creating, prompt, rootPath]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-[720px] flex-col items-center gap-4">
        <h1 className="text-center text-ui-lg font-semibold text-fg-default">
          Ask Pragma to work in this folder
        </h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void startThread();
          }}
          className="w-full rounded-xl border border-border/60 bg-bg-elevated p-3 shadow-[var(--shadow-sm)] transition-colors focus-within:border-primary/40"
        >
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (isHomePromptSubmitKey(event)) {
                event.preventDefault();
                void startThread();
              }
            }}
            rows={3}
            placeholder="Describe what you want to build, fix or explain."
            disabled={!rootPath}
            className="min-h-16 resize-none border-0 bg-transparent px-1 py-1 text-ui-md shadow-none focus-visible:bg-transparent focus-visible:ring-0"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            {!rootPath && (
              <span className="truncate text-ui-xs text-fg-subtle">
                Open a folder to start a thread.
              </span>
            )}
            {error && (
              <span role="alert" className="truncate text-ui-xs text-status-error">
                {error}
              </span>
            )}
            <Button type="submit" size="sm" disabled={!rootPath || creating}>
              <PaperPlaneRight size={13} weight="bold" />
              {homePromptLabel(prompt)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
