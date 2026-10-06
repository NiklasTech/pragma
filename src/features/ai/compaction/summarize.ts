import { invoke } from "@tauri-apps/api/core";

import { stripReasoningTags } from "@/shared/lib/ai/protocol";
import type { EffectiveEngine } from "@/shared/lib/ai/sessionEngine";

interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

const SUMMARY_PROMPT =
  "You compact a coding conversation so it can continue in a smaller context window. Summarize it so the assistant can pick up the work without the original messages. Keep the user's goals and requirements, decisions and their reasons, files and code locations involved, changes already made, commands run and their important results, open errors and the next steps. Use short sections with bullet points, write in the language of the conversation and output only the summary.";

export async function summarizeConversation(
  engine: Pick<EffectiveEngine, "provider" | "model" | "baseUrl">,
  transcript: string,
): Promise<string> {
  const response = await invoke<ChatResponse>("ai_chat", {
    req: {
      provider: engine.provider,
      model: engine.model,
      base_url: engine.baseUrl,
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: `Summarize this conversation:\n\n${transcript}` },
      ],
      temperature: 0.2,
      // Reasoning models spend part of this budget thinking before they answer.
      max_tokens: 4096,
    },
  });

  const summary = stripReasoningTags(response.choices[0]?.message.content ?? "");
  if (!summary) throw new Error("The model returned an empty summary.");
  return summary;
}
