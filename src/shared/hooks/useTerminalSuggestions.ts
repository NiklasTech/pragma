import { useCallback, useEffect, useRef, useState } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/shared/stores/ai";
import { useEditorStore } from "@/shared/stores/editor";

const DEBOUNCE_MS = 300;
const MAX_OUTPUT_LEN = 1000;
const MAX_PROMPT_LEN = 512;

export interface SuggestionContext {
  cwd: string | null;
  language: string | null;
  lastOutput: string;
}

export interface UseTerminalSuggestionsOptions {
  term: XTerm | null;
  ptyId: string | null;
  enabled: boolean;
  cwd: string | null;
  lastOutputRef: React.MutableRefObject<string>;
}

export interface UseTerminalSuggestionsReturn {
  suggestion: string;
  loading: boolean;
  visible: boolean;
  accept: () => void;
  dismiss: () => void;
  handleData: (data: string) => boolean;
}

function isPrintable(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 32 && code < 127;
}

export function appendInput(current: string, data: string): string {
  let buffer = current;
  let i = 0;

  while (i < data.length) {
    const char = data[i];

    if (char === "\r" || char === "\n") {
      buffer = "";
      i += 1;
      continue;
    }

    if (char === "\u0003") {
      // Ctrl+C
      buffer = "";
      i += 1;
      continue;
    }

    if (char === "\b" || char === "\u007f") {
      buffer = buffer.slice(0, -1);
      i += 1;
      continue;
    }

    if (char === "\u001b") {
      // Skip ANSI escape sequence: ESC [ ... letter or ESC letter
      i += 1;
      if (i < data.length && data[i] === "[") {
        i += 1;
        while (i < data.length && data[i].charCodeAt(0) >= 0x20 && data[i].charCodeAt(0) <= 0x3f) {
          i += 1;
        }
        if (i < data.length) {
          i += 1;
        }
      } else if (i < data.length) {
        i += 1;
      }
      continue;
    }

    if (isPrintable(char) && buffer.length < MAX_PROMPT_LEN) {
      buffer += char;
    }

    i += 1;
  }

  return buffer;
}

export function useTerminalSuggestions({
  term,
  ptyId,
  enabled,
  cwd,
  lastOutputRef,
}: UseTerminalSuggestionsOptions): UseTerminalSuggestionsReturn {
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const inputRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const terminalSuggestionProvider = useAIStore((state) => state.terminalSuggestionProvider);
  const terminalSuggestionModel = useAIStore((state) => state.terminalSuggestionModel);
  const providers = useAIStore((state) => state.providers);
  const activeTab = useEditorStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId),
  );

  const provider = terminalSuggestionProvider ?? activeProvider;
  const model = terminalSuggestionModel ?? activeModel;
  const baseUrl = providers[provider].baseUrl;
  const language = activeTab?.kind === "file" ? (activeTab.language ?? null) : null;

  const dismiss = useCallback(() => {
    setVisible(false);
    setSuggestion("");
  }, []);

  const accept = useCallback(() => {
    if (!suggestion || !ptyId) return;
    void invoke("write_pty", { id: ptyId, data: suggestion });
    inputRef.current += suggestion;
    dismiss();
  }, [suggestion, ptyId, dismiss]);

  const fetchSuggestion = useCallback(
    async (currentInput: string) => {
      if (!enabled || !term) return;
      if (provider === "custom" && !baseUrl) return;

      const lastOutput = lastOutputRef.current.slice(-MAX_OUTPUT_LEN);

      setLoading(true);
      abortRef.current = false;

      try {
        const response = await invoke<{ suggestion: string }>("ai_terminal_suggestion", {
          req: {
            provider,
            model,
            baseUrl,
            prompt: currentInput,
            cwd,
            language,
            last_output: lastOutput || null,
          },
        });

        if (abortRef.current) return;
        if (inputRef.current !== currentInput) return;

        const text = response.suggestion.trim();
        if (text && text !== currentInput) {
          setSuggestion(text);
          setVisible(true);
        } else {
          dismiss();
        }
      } catch (err) {
        if (abortRef.current) return;
        dismiss();
        console.error("[Terminal Suggestion Error]", err);
      } finally {
        if (!abortRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled, term, provider, model, baseUrl, cwd, language, lastOutputRef, dismiss],
  );

  const handleData = useCallback(
    (data: string): boolean => {
      if (!enabled || !term) return false;

      if (data === "\t") {
        if (visible) {
          accept();
          return true;
        }
        return false;
      }

      if (data === "\u001b") {
        dismiss();
        return false;
      }

      const nextInput = appendInput(inputRef.current, data);
      if (nextInput !== inputRef.current) {
        inputRef.current = nextInput;
        dismiss();

        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        if (nextInput.trim().length > 0) {
          debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            void fetchSuggestion(nextInput);
          }, DEBOUNCE_MS);
        }
      }

      return false;
    },
    [enabled, term, visible, accept, dismiss, fetchSuggestion],
  );

  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    suggestion,
    loading,
    visible,
    accept,
    dismiss,
    handleData,
  };
}
