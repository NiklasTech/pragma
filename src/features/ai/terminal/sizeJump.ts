/** A change this large is a zoom or layout switch, not a drag of a split handle. */
const JUMP_RATIO = 1.3;

/// True when the new size differs from the drawn terminal by a zoom-sized step in either direction.
export function isSizeJump(
  drawn: { width: number; height: number } | undefined,
  width: number,
  height: number,
): boolean {
  if (!drawn || drawn.width <= 0 || drawn.height <= 0 || width <= 0 || height <= 0) return false;
  const ratio = (next: number, previous: number) => Math.max(next / previous, previous / next);
  return ratio(width, drawn.width) >= JUMP_RATIO || ratio(height, drawn.height) >= JUMP_RATIO;
}
