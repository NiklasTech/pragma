import { invoke } from "@tauri-apps/api/core";
import { stripReasoningTags } from "@/shared/lib/ai/protocol";
import type { AIProvider } from "@/shared/stores/ai";

interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

export const MAX_DIFF_CHARS = 40_000;

const COMMIT_PROMPT =
  "You write git commit messages in the Conventional Commits format. The first line is `type(optional scope): subject` with a lowercase type from feat, fix, docs, style, refactor, perf, test, build, ci, chore or revert, an imperative subject and at most 72 characters. Add a short body after a blank line only when the change needs an explanation. Output only the commit message, without quotes or code fences.";

export interface CommitMessageEngine {
  provider: AIProvider;
  model: string;
  baseUrl: string | undefined;
}

export function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`;
}

export function cleanCommitMessage(reply: string): string {
  const text = stripReasoningTags(reply);
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text);
  return (fenced?.[1] ?? text).trim();
}

export async function generateCommitMessage(
  engine: CommitMessageEngine,
  repoPath: string,
): Promise<string> {
  const { diff_text: diff } = await invoke<{ diff_text: string }>("git_diff", {
    repoPath,
    path: null,
    staged: true,
  });
  if (!diff.trim()) throw new Error("There are no staged changes.");

  const response = await invoke<ChatResponse>("ai_chat", {
    req: {
      provider: engine.provider,
      model: engine.model,
      base_url: engine.baseUrl,
      messages: [
        { role: "system", content: COMMIT_PROMPT },
        {
          role: "user",
          content: `Write the commit message for this staged diff:\n\n${truncateDiff(diff)}`,
        },
      ],
      temperature: 0.2,
      // Reasoning models spend part of this budget thinking before they answer.
      max_tokens: 4096,
    },
  });

  const message = cleanCommitMessage(response.choices[0]?.message.content ?? "");
  if (!message) throw new Error("The model returned an empty commit message.");
  return message;
}
