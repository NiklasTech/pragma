import type { ReviewComment } from "./comments";

export function commentLocation(comment: Pick<ReviewComment, "path" | "side" | "line">): string {
  const location = `${comment.path}:${comment.line}`;
  return comment.side === "old" ? `${location} (removed line)` : location;
}

function fenceFor(code: string): string {
  const longestRun = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(longestRun + 1);
}

/** One message with every comment, its location and the quoted line. */
export function buildReviewMessage(comments: readonly ReviewComment[]): string {
  const sorted = [...comments].sort(
    (a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.side.localeCompare(b.side),
  );
  const items = sorted.map((comment, index) => {
    const fence = fenceFor(comment.code);
    return [
      `${index + 1}. ${commentLocation(comment)}`,
      fence,
      comment.code,
      fence,
      comment.body.trim(),
    ].join("\n");
  });
  return ["Please address these review comments on your changes:", ...items].join("\n\n");
}
