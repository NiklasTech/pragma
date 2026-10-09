import type { Text } from "@codemirror/state";

export interface EditRegion {
  offset: number;
  removed: string;
  inserted: string;
}

export interface PredictedEdit {
  line: number;
  find: string;
  replace: string;
}

const WORD = /\w/;
const NEARBY_LINES = 3;

/// The one region that differs between two texts, widened to whole words.
export function diffRegion(before: string, after: string): EditRegion | null {
  if (before === after) return null;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  // Only a change that starts or ends inside a word grows to that whole word.
  const startsInWord = WORD.test(before[start] ?? "") || WORD.test(after[start] ?? "");
  const endsInWord = WORD.test(before[endBefore - 1] ?? "") || WORD.test(after[endAfter - 1] ?? "");
  while (startsInWord && start > 0 && WORD.test(before[start - 1] ?? "")) start -= 1;
  while (endsInWord && endBefore < before.length && WORD.test(before[endBefore] ?? "")) {
    endBefore += 1;
    endAfter += 1;
  }
  return {
    offset: start,
    removed: before.slice(start, endBefore),
    inserted: after.slice(start, endAfter),
  };
}

/// Where a predicted edit applies: its line first, then the nearest lines, never the cursor line.
export function locatePrediction(
  doc: Text,
  edit: PredictedEdit,
  cursorLine: number,
): { from: number; to: number } | null {
  for (let distance = 0; distance <= NEARBY_LINES; distance += 1) {
    for (const lineNumber of distance === 0
      ? [edit.line]
      : [edit.line - distance, edit.line + distance]) {
      if (lineNumber < 1 || lineNumber > doc.lines || lineNumber === cursorLine) continue;
      const line = doc.line(lineNumber);
      const index = line.text.indexOf(edit.find);
      if (index >= 0) return { from: line.from + index, to: line.from + index + edit.find.length };
    }
  }
  return null;
}
