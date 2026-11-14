import { lspFormatDocument } from "./client";
import { applyEditsToContent } from "./edits";
import { flushLspDocumentSync } from "./lspDocuments";
import { getLspFeatureFlags } from "./lspFlags";

export interface FormatOnSaveOptions {
  tabSize: number;
  insertSpaces: boolean;
}

/** Formats content with the file's language server; returns it unchanged when none can format. */
export async function formatForSave(
  content: string,
  language: string | undefined,
  filePath: string,
  options: FormatOnSaveOptions,
): Promise<string> {
  if (!language || !getLspFeatureFlags(filePath)?.formatting) return content;
  try {
    await flushLspDocumentSync(language, filePath, content);
    const edits = await lspFormatDocument(
      language,
      filePath,
      options.tabSize,
      options.insertSpaces,
    );
    return edits.length > 0 ? applyEditsToContent(content, edits) : content;
  } catch (error) {
    // A failing formatter must never block the save itself.
    console.error("Format on save failed", error);
    return content;
  }
}
