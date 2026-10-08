"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaperPlaneRight, Plug, Plus, Stop } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { useLayoutStore } from "@/shell/layout/store";
import { insertAtCursor } from "@/features/ai/dictation/insertAtCursor";
import { useComposerDictation } from "@/features/ai/dictation/useComposerDictation";
import { usePushToTalk } from "@/features/ai/dictation/usePushToTalk";

import { CliSessionOptionsMenu } from "@/features/ai/acp/CliSessionOptionsMenu";
import { McpServersMenu } from "@/features/ai/mcp/McpServersMenu";
import { PromptPicker, type PromptPickerRef } from "@/features/ai/mcp/PromptPicker";
import { useCliSessionOptions } from "@/features/ai/acp/useCliSessionOptions";
import { ContextMeter } from "@/features/ai/usage/ContextMeter";
import { ComposerImageButton } from "@/features/ai/images/ComposerImageButton";
import { ComposerImages } from "@/features/ai/images/ComposerImages";
import { isAcceptedImage } from "@/features/ai/images/readImage";
import type { ComposerImage } from "@/features/ai/images/useComposerImages";
import { useImageFileDrop } from "@/features/ai/images/useImageFileDrop";
import { useImageInputSupport } from "@/features/ai/images/useImageInputSupport";
import { useComposerInsert } from "@/features/ai/mentions/composerInsert";

import { AiModelSelector } from "./AiModelSelector";
import { ChatToolbar } from "./ChatToolbar";
import { ComposerMicButton } from "./ComposerMicButton";
import { ContextPicker, type ContextPickerRef } from "./ContextPicker";

interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  isStreaming: boolean;
  inFlight?: boolean;
  canChat: boolean;
  mcpLoaded: boolean;
  onStop: () => void;
  images: ComposerImage[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
}

export function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isStreaming,
  inFlight,
  canChat,
  mcpLoaded,
  onStop,
  images,
  onAddImages,
  onRemoveImage,
}: ChatComposerProps) {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const sendShortcut = useSettingsStore((state) => state.shortcuts["chat.send"]);
  const voiceInput = useSettingsStore((state) => state.ai.voiceInput);
  const cliSession = useCliSessionOptions();
  const voiceEngine = useSettingsStore((state) => state.ai.voiceEngine);
  const voiceModel = useSettingsStore((state) =>
    state.ai.voiceEngine === "whisper" ? state.ai.whisperModel : state.ai.parakeetModel,
  );
  const holdToDictate = useSettingsStore((state) => state.shortcuts["voice.holdToDictate"]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contextPickerRef = useRef<ContextPickerRef>(null);
  const promptPickerRef = useRef<PromptPickerRef>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const cursorRef = useRef(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const isInFlight = inFlight ?? (isLoading || isStreaming);
  const hasContent = input.trim().length > 0 || images.length > 0;
  const imageSupport = useImageInputSupport();
  const unsupportedReason = imageSupport.supported ? null : imageSupport.reason;
  const formRef = useRef<HTMLFormElement>(null);

  const attachImages = useCallback(
    (files: File[]) => {
      if (unsupportedReason) {
        toast.error(unsupportedReason);
        return;
      }
      onAddImages(files);
    },
    [onAddImages, unsupportedReason],
  );

  const dropActive = useImageFileDrop(formRef, attachImages);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files).filter(isAcceptedImage);
      if (files.length === 0) return;
      // Plain screenshots carry no text; keep the text paste when the clipboard has both.
      if (!e.clipboardData.getData("text/plain")) e.preventDefault();
      attachImages(files);
    },
    [attachImages],
  );

  const prefillPrompt = useAIEditStore((state) => state.prefillPrompt);
  const consumePrefill = useAIEditStore((state) => state.consumePrefill);

  useEffect(() => {
    if (!prefillPrompt) return;
    if (inputRef.current !== prefillPrompt) {
      onInputChange(prefillPrompt);
    }
    consumePrefill();
  }, [prefillPrompt, consumePrefill, onInputChange]);

  useComposerInsert(inputRef, onInputChange, textareaRef);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const openSettings = () => {
    useLayoutStore.getState().addFloatingPanel("settings");
  };

  const moveCursor = useCallback((position: number) => {
    cursorRef.current = position;
    setCursorPosition(position);
  }, []);

  const updateCursorPosition = useCallback(() => {
    moveCursor(textareaRef.current?.selectionStart ?? 0);
  }, [moveCursor]);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(e.target.value);
      moveCursor(e.target.selectionStart);
    },
    [moveCursor, onInputChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (contextPickerRef.current?.handleKeyDown(e)) {
        return;
      }
      if (promptPickerRef.current?.handleKeyDown(e)) {
        return;
      }

      if (matchShortcut(e, sendShortcut)) {
        e.preventDefault();
        if (hasContent) {
          onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [hasContent, onSubmit, sendShortcut],
  );

  const handleContextSelect = useCallback(
    (value: string, position: number) => {
      onInputChange(value);
      moveCursor(position);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(position, position);
        }
      });
    },
    [moveCursor, onInputChange],
  );

  const insertContextMention = useCallback(() => {
    const position = textareaRef.current?.selectionStart ?? input.length;
    onInputChange(`${input.slice(0, position)}@${input.slice(position)}`);
    moveCursor(position + 1);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(position + 1, position + 1);
      }
    });
  }, [input, moveCursor, onInputChange]);

  // Live dictation rewrites the text between the cursor at start and the text after it.
  const dictationBaseRef = useRef<{ value: string; position: number } | null>(null);
  const [dictationLive, setDictationLive] = useState(false);

  const handleDictationText = useCallback(
    (text: string, final: boolean) => {
      if (!dictationBaseRef.current) {
        const value = inputRef.current;
        dictationBaseRef.current = { value, position: Math.min(cursorRef.current, value.length) };
      }
      const base = dictationBaseRef.current;
      setDictationLive(!final);
      if (final) {
        dictationBaseRef.current = null;
      }
      const result = insertAtCursor(base.value, text, base.position);
      if (result.value !== inputRef.current) {
        onInputChange(result.value);
      }
      moveCursor(result.cursor);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          if (final) textarea.focus();
          textarea.setSelectionRange(result.cursor, result.cursor);
        }
      });
    },
    [moveCursor, onInputChange],
  );

  const dictation = useComposerDictation({
    engine: voiceEngine,
    model: voiceModel,
    enabled: voiceInput,
    onText: handleDictationText,
  });

  const claimPushToTalk = usePushToTalk({
    enabled: voiceInput,
    binding: holdToDictate,
    start: dictation.start,
    stop: dictation.stop,
  });

  return (
    <div className="flex flex-col gap-2">
      {!canChat && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-border bg-bg-surface py-2 pr-2 pl-3">
          <Plug size={15} className="shrink-0 text-fg-subtle" />
          <span className="min-w-[160px] flex-1 text-ui-xs text-fg-muted">
            Connect an AI provider to start working with Pragma.
          </span>
          <button
            type="button"
            onClick={openSettings}
            className="ml-auto shrink-0 rounded-full bg-fg-default px-3 py-1 text-ui-xs font-medium text-bg-root transition-colors hover:bg-fg-default/85"
          >
            Configure a provider in Settings
          </button>
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className={cn(
          "flex flex-col gap-1 rounded-2xl border border-border bg-bg-surface shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_var(--color-accent-subtle)]",
          dropActive && "border-primary shadow-[0_0_0_3px_var(--color-accent-subtle)]",
        )}
      >
        <ComposerImages
          images={images}
          onRemove={onRemoveImage}
          unsupportedReason={unsupportedReason}
        />
        <div className="relative px-3.5 pt-3">
          <Textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            onSelect={updateCursorPosition}
            onFocus={claimPushToTalk}
            onPaste={handlePaste}
            placeholder="Ask Pragma anything. Type @ to add context."
            className={cn(
              "max-h-48 min-h-10 resize-none border-0 bg-transparent px-0 py-1 text-ui-md shadow-none transition-colors duration-300 focus-visible:ring-0 focus-visible:shadow-none focus-visible:bg-transparent disabled:bg-transparent",
              dictationLive && "text-fg-muted",
            )}
          />
          <ContextPicker
            ref={contextPickerRef}
            input={input}
            cursorPosition={cursorPosition}
            rootPath={rootPath}
            onSelect={handleContextSelect}
          />
          <PromptPicker
            ref={promptPickerRef}
            input={input}
            cursorPosition={cursorPosition}
            onSelect={handleContextSelect}
          />
        </div>
        <div className="flex flex-nowrap items-center gap-1 px-2 pb-2">
          <button
            type="button"
            onClick={insertContextMention}
            aria-label="Add context"
            title="Add files and context (@)"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={13} weight="bold" />
          </button>
          <ComposerImageButton support={imageSupport} onPick={attachImages} />
          {cliSession ? (
            <CliSessionOptionsMenu session={cliSession} />
          ) : (
            <AiModelSelector variant="compact" />
          )}
          <ChatToolbar />
          <McpServersMenu />
          <div className="ml-auto flex items-center gap-1">
            <ContextMeter />
            {voiceInput && (
              <ComposerMicButton
                recording={dictation.recording}
                onClick={dictation.toggle}
                subscribeLevel={voiceEngine === "web-speech" ? undefined : dictation.subscribeLevel}
              />
            )}
            {isInFlight && (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop"
                title="Stop"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-status-error/15 text-status-error transition-colors hover:bg-status-error/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error/40"
              >
                <Stop size={12} weight="fill" />
              </button>
            )}
            {(!isInFlight || hasContent) && (
              <button
                type="submit"
                aria-label="Send"
                title="Send"
                disabled={
                  !hasContent ||
                  !canChat ||
                  !mcpLoaded ||
                  (images.length > 0 && unsupportedReason !== null)
                }
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fg-default text-bg-root transition-colors hover:bg-fg-default/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:bg-bg-hover disabled:text-fg-subtle"
              >
                <PaperPlaneRight size={13} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </form>
      {dictation.status && <p className="px-3 text-ui-2xs text-fg-muted">{dictation.status}</p>}
    </div>
  );
}
