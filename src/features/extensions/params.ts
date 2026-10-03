/// Validation helpers for bridge request params; every value comes from an untrusted extension.

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function requireParams(params: unknown): Record<string, unknown> {
  const record = asRecord(params);
  if (!record) throw new Error("params must be an object");
  return record;
}

export function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`"${key}" must be a non-empty string`);
  }
  return value;
}

export function requireText(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`"${key}" must be a string`);
  }
  return value;
}

export function optionalString(
  obj: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`"${key}" must be a string of at most ${maxLength} characters`);
  }
  return value;
}
