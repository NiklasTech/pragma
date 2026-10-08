import type { IBuffer } from "@xterm/xterm";

/** The OSC 133 marks: prompt start, input start, output start and command end. */
export type ShellMark =
  | { kind: "promptStart" }
  | { kind: "inputStart" }
  | { kind: "outputStart" }
  | { kind: "commandEnd"; exitCode: number | null };

export const MAX_OUTPUT_LINES = 200;

export function parseShellMark(data: string): ShellMark | null {
  const [kind, ...params] = data.split(";");
  switch (kind) {
    case "A":
      return { kind: "promptStart" };
    case "B":
      return { kind: "inputStart" };
    case "C":
      return { kind: "outputStart" };
    case "D": {
      const exitCode = params[0]?.trim() ? Number(params[0]) : NaN;
      return { kind: "commandEnd", exitCode: Number.isInteger(exitCode) ? exitCode : null };
    }
    default:
      return null;
  }
}

type BufferLines = Pick<IBuffer, "getLine">;

/** The text from `(startLine, startColumn)` up to and including `endLine`, joining wrapped rows. */
export function readBufferText(
  buffer: BufferLines,
  startLine: number,
  startColumn: number,
  endLine: number,
): string {
  const lines: string[] = [];
  for (let index = startLine; index <= endLine; index++) {
    const line = buffer.getLine(index);
    if (!line) break;
    const text = line.translateToString(true, index === startLine ? startColumn : 0);
    if (line.isWrapped && lines.length > 0) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  return lines.join("\n");
}

/** The command typed between the input mark and the output mark. */
export function readCommandText(
  buffer: BufferLines,
  inputLine: number,
  inputColumn: number,
  outputLine: number,
): string {
  const endLine = Math.max(inputLine, outputLine - 1);
  return readBufferText(buffer, inputLine, inputColumn, endLine).trim();
}

/** The last `MAX_OUTPUT_LINES` lines a command printed, without trailing blank lines. */
export function readCommandOutput(
  buffer: BufferLines,
  outputLine: number,
  endLine: number,
): string {
  const lines = readBufferText(buffer, outputLine, 0, endLine).split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.slice(-MAX_OUTPUT_LINES).join("\n");
}

/** The nearest prompt line before or after `anchor` in the sorted `promptLines`, or null. */
export function findJumpTarget(
  promptLines: readonly number[],
  anchor: number,
  direction: "previous" | "next",
): number | null {
  if (direction === "next") return promptLines.find((line) => line > anchor) ?? null;
  for (let index = promptLines.length - 1; index >= 0; index--) {
    if (promptLines[index] < anchor) return promptLines[index];
  }
  return null;
}
