const MAX_WORDS = 6;
const MAX_LENGTH = 48;

/// Builds a short title from the first user message when no model title is available.
export function fallbackChatTitle(message: string): string {
  const firstLine = message
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "";

  const words = firstLine.replace(/\s+/g, " ").split(" ");
  let title = words.slice(0, MAX_WORDS).join(" ");
  if (title.length > MAX_LENGTH) title = title.slice(0, MAX_LENGTH).trimEnd();
  if (title.length < firstLine.length) title = `${title.replace(/[.,;:!?]+$/, "")}…`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}
