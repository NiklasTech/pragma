"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gear, PaperPlaneRight, Plus, Stop } from "@phosphor-icons/react";

import { Textarea } from "@/shared/components/ui/textarea";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout/store";

import { AiModelSelector } from "./AiModelSelector";
import { ChatToolbar } from "./ChatToolbar";
import { ContextPicker, type ContextPickerRef } from "./ContextPicker";

interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  isStreaming: boolean;
  canChat: boolean;
  mcpLoaded: boolean;
  onStop: () => void;
}

export function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isStreaming,
  canChat,
  mcpLoaded,
  onStop,
}: ChatComposerProps) {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const sendShortcut = useSettingsStore((state) => state.shortcuts["chat.send"]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contextPickerRef = useRef<ContextPickerRef>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const [cursorPosition, setCursorPosition] = useState(0);

  const disabled = !canChat || isLoading;

  const { prefillPrompt, consumePrefill } = useAIEditStore();

  useEffect(() => {
    if (!prefillPrompt) return;
    if (inputRef.current !== prefillPrompt) {
      onInputChange(prefillPrompt);
    }
    consumePrefill();
  }, [prefillPrompt, consumePrefill, onInputChange]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const openSettings = () => {
    useLayoutStore.getState().addFloatingPanel("settings");
  };

  const updateCursorPosition = useCallback(() => {
    setCursorPosition(textareaRef.current?.selectionStart ?? 0);
  }, []);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(e.target.value);
      setCursorPosition(e.target.selectionStart);
    },
    [onInputChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (contextPickerRef.current?.handleKeyDown(e)) {
        return;
      }

      if (matchShortcut(e, sendShortcut)) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [input, isLoading, onSubmit, sendShortcut],
  );

  const handleContextSelect = useCallback(
    (value: string, position: number) => {
      onInputChange(value);
      setCursorPosition(position);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(position, position);
        }
      });
    },
    [onInputChange],
  );

  const insertContextMention = useCallback(() => {
    const position = textareaRef.current?.selectionStart ?? input.length;
    onInputChange(`${input.slice(0, position)}@${input.slice(position)}`);
    setCursorPosition(position + 1);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(position + 1, position + 1);
      }
    });
  }, [input, onInputChange]);

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-bg-input px-2 pb-2 transition-all focus-within:border-primary/40 focus-within:bg-bg-elevated focus-within:ring-2 focus-within:ring-primary/20"
      >
        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            onSelect={updateCursorPosition}
            placeholder="Ask anything..."
            disabled={disabled}
            className="max-h-48 min-h-9 resize-none border-0 bg-transparent px-0 py-1.5 text-ui-sm shadow-none focus-visible:ring-0 focus-visible:bg-transparent disabled:bg-transparent"
          />
          <ContextPicker
            ref={contextPickerRef}
            input={input}
            cursorPosition={cursorPosition}
            rootPath={rootPath}
            onSelect={handleContextSelect}
          />
        </div>
        <div className="flex flex-nowrap items-center gap-0.5 pt-1.5">
          <button
            type="button"
            onClick={insertContextMention}
            disabled={disabled}
            aria-label="Add context"
            title="Add context"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={13} weight="bold" />
          </button>
          <AiModelSelector variant="compact" />
          <ChatToolbar />
          <div className="ml-auto flex items-center gap-0.5">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop"
                title="Stop"
                className="flex size-6 shrink-0 items-center justify-center rounded-md bg-status-error text-fg-inverse transition-colors hover:bg-status-error/90"
              >
                <Stop size={13} weight="bold" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                title="Send"
                disabled={!input.trim() || isLoading || !canChat || !mcpLoaded}
                className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary"
              >
                <PaperPlaneRight size={13} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </form>
      {!canChat && (
        <button
          type="button"
          onClick={openSettings}
          className="mt-1 flex min-w-0 max-w-full items-center gap-1 text-ui-2xs text-fg-muted transition-colors hover:text-fg-default"
        >
          <Gear size={11} className="shrink-0" />
          <span className="min-w-0 truncate">Configure a provider in Settings</span>
        </button>
      )}
    </div>
  );
}
