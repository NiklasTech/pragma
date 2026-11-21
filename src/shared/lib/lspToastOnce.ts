const shown = new Set<string>();

/** True the first time a language reports this failure in this app session. */
export function firstLspFailure(language: string, message: string): boolean {
  const key = `${language}:${message}`;
  if (shown.has(key)) return false;
  shown.add(key);
  return true;
}
