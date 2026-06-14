export interface ExtractedCodeBlock {
  language?: string;
  code: string;
}

const CODE_BLOCK_REGEX = /```(?:([\w+-.]+)\n)?([\s\S]*?)```/;

export function extractFirstCodeBlock(markdown: string): ExtractedCodeBlock | null {
  const match = CODE_BLOCK_REGEX.exec(markdown);
  if (!match) return null;

  const language = match[1]?.trim();
  const code = match[2].trim();

  return { language, code };
}
