export interface ChatContextResult {
  content: string;
  files_read: number;
  tokens_used: number;
  truncated: boolean;
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
