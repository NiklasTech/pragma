/** A unified diff for a file that only exists on the modified side. */
export function addedFilePatch(original: string, modified: string): string {
  if (original.length > 0 || modified.length === 0) return "";
  const lines = modified.replace(/\r?\n$/, "").split(/\r?\n/);
  return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
}
