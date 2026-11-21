import { toast } from "sonner";

import { isMissingTypeScript, lspErrorMessage } from "@/shared/lib/lsp-servers";
import { useLspFailuresStore } from "@/shared/stores/lspFailures";
import { useLspRetryStore } from "@/shared/stores/lspRetry";

import { installTypeScript } from "./installTypeScript";

const NOT_RUNNING = /is not running$/;

const LANGUAGE_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  rust: "Rust",
  python: "Python",
  go: "Go",
};

/** True when the request failed because no server runs for the file's project. */
export function isServerNotRunning(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return NOT_RUNNING.test(message);
}

/// Tells why a code action could not run: why the language server is down and how to fix it,
/// instead of the raw backend message with the project's full path.
export function showLspRequestError(language: string, error: unknown): void {
  if (!isServerNotRunning(error)) {
    toast.error(error instanceof Error ? error.message : String(error));
    return;
  }
  const failure = useLspFailuresStore.getState().byLanguage[language];
  const name = LANGUAGE_NAMES[language] ?? language;
  const message = failure
    ? lspErrorMessage(language, failure)
    : `${name} code navigation is not ready for this folder: its language server is not running.`;
  toast.error(message, {
    id: `lsp:${language}:${message}`,
    action: isMissingTypeScript(failure)
      ? { label: "Install TypeScript", onClick: () => void installTypeScript() }
      : { label: "Try again", onClick: () => useLspRetryStore.getState().retry() },
  });
}
