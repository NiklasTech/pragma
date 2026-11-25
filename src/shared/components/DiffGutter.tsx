import type { PatchLine } from "@/shared/lib/diffHunks";

/// The old and the new line number of a diff line, the same in every diff of the app.
export function DiffGutter({ line, digits }: { line: PatchLine; digits: number }) {
  const style = { width: `calc(${digits}ch + 10px)` };
  const cell = "shrink-0 pr-1.5 text-right leading-5 text-fg-subtle tabular-nums select-none";
  return (
    <>
      <span className={cell} style={style} data-diff-line="old">
        {line.oldLine ?? ""}
      </span>
      <span className={cell} style={style} data-diff-line="new">
        {line.newLine ?? ""}
      </span>
    </>
  );
}
