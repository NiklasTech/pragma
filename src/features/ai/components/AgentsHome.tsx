"use client";

import { useCallback, useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

export function AgentsHome() {
  const [prompt, setPrompt] = useState("");
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const createChatSession = useAIStore((state) => state.createChatSession);

  const handleNewThread = useCallback(() => {
    if (!rootPath) return;
    void createChatSession(rootPath);
    setPrompt("");
  }, [createChatSession, rootPath]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-[720px] flex-col items-center gap-4">
        <h1 className="text-center text-ui-lg font-semibold text-fg-default">
          Ask Pragma to work in this folder
        </h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleNewThread();
          }}
          className="w-full rounded-xl border border-border/60 bg-bg-elevated p-3 shadow-[var(--shadow-sm)] transition-colors focus-within:border-primary/40"
        >
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
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
            <Button type="submit" size="sm" disabled={!rootPath}>
              <PaperPlaneRight size={13} weight="bold" />
              New thread
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
