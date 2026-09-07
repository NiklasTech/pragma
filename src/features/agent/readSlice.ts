export interface FileSlice {
  text: string;
  startLine: number;
  endLine: number;
  totalLines: number;
}

function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  const lines = content.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function normalizeOffset(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function sliceFileLines(content: string, offset?: number, limit?: number): FileSlice {
  const lines = splitLines(content);
  const totalLines = lines.length;

  if (totalLines === 0) {
    return { text: "", startLine: 0, endLine: 0, totalLines: 0 };
  }

  const startLine = normalizeOffset(offset);
  const limitLines =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : undefined;
  const endLine =
    limitLines === undefined ? totalLines : Math.min(totalLines, startLine + limitLines - 1);

  if (startLine > totalLines) {
    return {
      text: `[Read lines ${startLine}-${startLine - 1} of ${totalLines}]`,
      startLine,
      endLine: startLine - 1,
      totalLines,
    };
  }

  const sliced = startLine > 1 || endLine < totalLines;
  const body = lines.slice(startLine - 1, endLine).join("\n");
  const text = sliced ? `[Read lines ${startLine}-${endLine} of ${totalLines}]\n${body}` : content;

  return { text, startLine, endLine, totalLines };
}
