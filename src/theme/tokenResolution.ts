import type { ThemeTokens } from "./types";

const REF_REGEX = /^\{([a-zA-Z0-9_.-]+)\}$/;

export interface CssVariableMapping {
  name: string;
  value: string;
}

function isRef(value: string): boolean {
  return REF_REGEX.test(value);
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function resolveValue(
  value: string,
  tokens: ThemeTokens,
  visited: Set<string> = new Set(),
): string {
  if (!isRef(value)) return value;

  const match = REF_REGEX.exec(value);
  if (!match) return value;

  const path = match[1];
  if (visited.has(path)) {
    return value;
  }

  visited.add(path);
  const resolved = getPath(tokens, path);

  if (typeof resolved !== "string") {
    return value;
  }

  return resolveValue(resolved, tokens, visited);
}

export function flattenTokens(
  prefix: string,
  value: unknown,
  mappings: CssVariableMapping[],
  resolve: (v: string) => string,
): void {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    mappings.push({ name: prefix, value: resolve(value) });
    return;
  }

  if (typeof value === "number") {
    mappings.push({ name: prefix, value: String(value) });
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPrefix = prefix ? `${prefix}-${toKebab(key)}` : toKebab(key);
      flattenTokens(childPrefix, child, mappings, resolve);
    }
  }
}

function toKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
