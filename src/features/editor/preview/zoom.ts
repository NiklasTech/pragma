export type Zoom = "fit" | number;

const STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8];

/// The next zoom step in `direction`; from Fit, zooming starts at 100%.
export function nextZoom(current: Zoom, direction: 1 | -1): Zoom {
  if (current === "fit") return 1;
  if (direction > 0) return STEPS.find((step) => step > current) ?? STEPS[STEPS.length - 1];
  return [...STEPS].reverse().find((step) => step < current) ?? STEPS[0];
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
