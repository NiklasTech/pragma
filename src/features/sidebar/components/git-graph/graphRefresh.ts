import { PAGE_SIZE } from "./constants";

export function shouldRefreshGraph<T>(
  previousSnapshot: T | null,
  snapshot: T | null,
  loadedCount: number,
): boolean {
  return snapshot !== null && snapshot !== previousSnapshot && loadedCount > 0;
}

export function refreshLimit(loadedCount: number): number {
  return Math.max(PAGE_SIZE, loadedCount);
}
