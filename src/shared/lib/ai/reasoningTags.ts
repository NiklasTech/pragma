export function stripReasoningTags(text: string): string {
  const tags = [
    { open: "<thinking>", close: "</thinking>" },
    { open: "<reasoning>", close: "</reasoning>" },
    { open: "<think>", close: "</think>" },
  ];

  let cleaned = text;
  for (const { open, close } of tags) {
    const pattern = new RegExp(
      `${open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "g",
    );
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}
