export interface SaveTransformOptions {
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
}

/** Applies the on-save cleanups to file content, keeping its line endings. */
export function applySaveTransforms(content: string, options: SaveTransformOptions): string {
  let result = content;
  if (options.trimTrailingWhitespace) {
    result = result.replace(/[ \t]+(?=\r?\n|$)/g, "");
  }
  if (options.insertFinalNewline && result.length > 0 && !result.endsWith("\n")) {
    result += result.includes("\r\n") ? "\r\n" : "\n";
  }
  return result;
}
