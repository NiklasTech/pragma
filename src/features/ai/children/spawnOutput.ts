export function readSpawnOutput(output: unknown): { sessionId: string; title: string } | null {
  if (typeof output !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(output);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { sessionId, title } = parsed as Record<string, unknown>;
    if (typeof sessionId !== "string" || typeof title !== "string") return null;
    return { sessionId, title };
  } catch {
    return null;
  }
}
