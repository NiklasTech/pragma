/** The selection as a Markdown quote, followed by a blank line to answer below it. */
export function quoteMarkdown(text: string): string {
  const quoted = text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `${quoted}\n\n`;
}
