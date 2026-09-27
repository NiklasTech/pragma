import { invoke } from "@tauri-apps/api/core";

interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

export interface AgentDraft {
  name: string;
  brief: string;
}

export function parseAgentDraft(reply: string): AgentDraft | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const brief = typeof record.brief === "string" ? record.brief.trim() : "";
  if (!name || !brief) return null;

  return { name, brief };
}

export interface DraftAgentRequest {
  provider: string;
  model: string;
  baseUrl?: string;
  description: string;
}

export async function draftAgent(request: DraftAgentRequest): Promise<AgentDraft | null> {
  const response = await invoke<ChatResponse>("ai_chat", {
    req: {
      provider: request.provider,
      model: request.model,
      base_url: request.baseUrl,
      messages: [
        {
          role: "system",
          content:
            'You design a named coding agent. Reply with JSON only: {"name": "short name", "brief": "the system instruction for every chat of this agent"}.',
        },
        { role: "user", content: request.description },
      ],
      temperature: 0.4,
      max_tokens: 600,
    },
  });

  const content = response.choices[0]?.message.content ?? "";
  return parseAgentDraft(content);
}
