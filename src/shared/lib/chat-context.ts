export interface ChatContextResult {
  content: string;
  files_read: number;
  tokens_used: number;
  truncated: boolean;
}

export const AUTO_CONTEXT_TOKEN_CAP = 4000;

const CHARS_PER_TOKEN = 3;
const MIN_TRUNCATED_SECTION_CHARS = 120;
const TRUNCATION_NOTE = "\n[context truncated to fit the token cap]\n";

export const AUTO_CONTEXT_PREFIX =
  "The following workspace context was attached automatically. Use it only when relevant.";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface AutoContextSection {
  id: string;
  label: string;
  content: string;
}

export interface AutoContextAttachment {
  id: string;
  label: string;
  tokens: number;
  truncated: boolean;
}

export interface CappedAutoContext {
  text: string;
  attachments: AutoContextAttachment[];
  tokensUsed: number;
  truncated: boolean;
}

export function capAutoContextSections(
  sections: readonly AutoContextSection[],
  maxTokens: number = AUTO_CONTEXT_TOKEN_CAP,
): CappedAutoContext {
  const charBudget = Math.max(0, maxTokens) * CHARS_PER_TOKEN;
  const parts: string[] = [];
  const attachments: AutoContextAttachment[] = [];
  let usedChars = 0;
  let truncated = false;

  for (const section of sections) {
    const content = section.content.trim();
    if (!content) continue;

    const header = `--- ${section.label} ---\n`;
    const whole = `${header}${content}\n`;

    if (usedChars + whole.length <= charBudget) {
      parts.push(whole);
      usedChars += whole.length;
      attachments.push({
        id: section.id,
        label: section.label,
        tokens: estimateTokens(whole),
        truncated: false,
      });
      continue;
    }

    const remaining = charBudget - usedChars;
    const overhead = header.length + TRUNCATION_NOTE.length;
    if (remaining - overhead < MIN_TRUNCATED_SECTION_CHARS) {
      truncated = true;
      break;
    }

    const clipped = content.slice(0, remaining - overhead);
    const partial = `${header}${clipped}${TRUNCATION_NOTE}`;
    parts.push(partial);
    usedChars += partial.length;
    attachments.push({
      id: section.id,
      label: section.label,
      tokens: estimateTokens(partial),
      truncated: true,
    });
    truncated = true;
    break;
  }

  return {
    text: parts.join("\n"),
    attachments,
    tokensUsed: estimateTokens(parts.join("\n")),
    truncated,
  };
}

export interface ReadChatContextRequest {
  root_path: string;
  paths: string[];
  max_tokens?: number;
}

const MENTION_REGEX = /@(\S+)/g;

export function parseMentions(input: string): string[] {
  const mentions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = MENTION_REGEX.exec(input)) !== null) {
    mentions.push(match[1]);
  }

  return [...new Set(mentions)];
}

export function stripMentions(input: string): string {
  return input.replace(MENTION_REGEX, "").replace(/\s+/g, " ").trim();
}

export function buildContextUserMessage(contextContent: string, question: string): string {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) return contextContent;
  return `${contextContent}\n\n${trimmedQuestion}`;
}
