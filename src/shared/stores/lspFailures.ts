import { create } from "zustand";

interface LspFailuresState {
  /** The last reason a language's server failed to start, until one of its servers runs. */
  byLanguage: Readonly<Record<string, string>>;
}

export const useLspFailuresStore = create<LspFailuresState>()(() => ({ byLanguage: {} }));

export function recordLspStatus(language: string, status: string, error: string | undefined): void {
  const { byLanguage } = useLspFailuresStore.getState();
  if (status === "error" && error) {
    if (byLanguage[language] !== error) {
      useLspFailuresStore.setState({ byLanguage: { ...byLanguage, [language]: error } });
    }
    return;
  }
  if (status === "running" && language in byLanguage) {
    const next = { ...byLanguage };
    delete next[language];
    useLspFailuresStore.setState({ byLanguage: next });
  }
}
