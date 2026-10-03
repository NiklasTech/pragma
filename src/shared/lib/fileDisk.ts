/// Mirrors `CHANGED_ON_DISK_ERROR` in `src-tauri/src/modules/fs.rs`.
const CHANGED_ON_DISK_ERROR = "File changed on disk since it was loaded";

/// Hex SHA-256 of the UTF-8 bytes, matching the hash `write_text_file` checks against.
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isChangedOnDiskError(err: unknown): boolean {
  return String(err) === CHANGED_ON_DISK_ERROR;
}

/// `read_text_file` fails with these when the path is gone or is no longer a file.
export function isMissingFileError(err: unknown): boolean {
  const message = String(err);
  return message.startsWith("File not found:") || message.startsWith("Not a file:");
}

export function isSameOrInside(path: string, ancestor: string): boolean {
  if (path === ancestor) return true;
  return path.startsWith(`${ancestor}/`) || path.startsWith(`${ancestor}\\`);
}

export function parentPath(path: string): string {
  return path.substring(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}
