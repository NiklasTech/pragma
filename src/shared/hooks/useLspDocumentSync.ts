import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { useSettingsStore } from "@/shared/stores/settings";
import { markLspDocumentSynced, flushLspDocumentSync } from "@/features/editor/lsp/lspDocuments";

const DEBOUNCE_MS = 500;

export function useLspDocumentSync(
  language: string | undefined,
  filePath: string,
  content: string,
  isModified: boolean,
) {
  const lspEnabled = useSettingsStore((state) => state.lsp.enabled[language ?? ""] ?? true);
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);
  const openedRef = useRef<string | null>(null);
  const savedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!experimentalLsp || !lspEnabled || !language || !isLspSupported(language) || !filePath) {
      return;
    }

    if (openedRef.current === filePath) {
      return;
    }

    openedRef.current = filePath;
    let cancelled = false;

    const open = async () => {
      try {
        await invoke("lsp_did_open", {
          language,
          filePath,
          content,
        });
        if (!cancelled) {
          markLspDocumentSynced(filePath, content);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
    };

    void open();

    return () => {
      cancelled = true;
    };
  }, [language, filePath, lspEnabled, experimentalLsp]);

  useEffect(() => {
    if (!experimentalLsp || !lspEnabled || !language || !isLspSupported(language) || !filePath) {
      return;
    }

    if (openedRef.current !== filePath) {
      return;
    }

    const timer = setTimeout(() => {
      void flushLspDocumentSync(language, filePath, content).catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [language, filePath, content, lspEnabled, experimentalLsp]);

  useEffect(() => {
    if (!experimentalLsp || !lspEnabled || !language || !isLspSupported(language) || !filePath) {
      return;
    }

    if (isModified) {
      savedRef.current = null;
      return;
    }

    if (savedRef.current === filePath) {
      return;
    }

    if (openedRef.current !== filePath) {
      return;
    }

    savedRef.current = filePath;
    void (async () => {
      try {
        await invoke("lsp_did_save", { language, filePath });
      } catch {}
    })();
  }, [language, filePath, isModified, lspEnabled, experimentalLsp]);
}
