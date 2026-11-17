/** Which tree lines a row draws, like the `tree` command. */
export interface TreeGuide {
  /** No sibling follows this row, so its own line ends here: └ instead of ├. */
  last: boolean;
  /** Per ancestor depth 1..depth-1: whether that ancestor has a sibling below, so its line runs on. */
  through: boolean[];
}

/** Works out the tree lines of a flattened, depth-first list of rows in one pass from the bottom. */
export function treeGuides(rows: readonly { depth: number }[]): TreeGuide[] {
  const guides: TreeGuide[] = Array.from({ length: rows.length });
  // siblingBelow[d]: a row of depth d appears below before any shallower row.
  const siblingBelow: boolean[] = [];
  for (let index = rows.length - 1; index >= 0; index--) {
    const depth = rows[index]!.depth;
    const through: boolean[] = [];
    for (let level = 1; level < depth; level++) through.push(siblingBelow[level] === true);
    guides[index] = { last: siblingBelow[depth] !== true, through };
    siblingBelow[depth] = true;
    siblingBelow.length = depth + 1;
  }
  return guides;
}
