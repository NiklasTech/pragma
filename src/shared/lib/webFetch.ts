import { invoke } from "@tauri-apps/api/core";

export interface FetchedUrl {
  url: string;
  status: number;
  contentType: string;
  text: string;
  truncated: boolean;
}

/** Fetches an http(s) URL through the backend and returns its readable text. */
export function fetchUrlText(url: string): Promise<FetchedUrl> {
  return invoke<FetchedUrl>("fetch_url_text", { url });
}

/** The fetched text with a status header, cut to `maxChars`. */
export function formatFetchedUrl(result: FetchedUrl, maxChars: number): string {
  const truncated = result.truncated || result.text.length > maxChars;
  const header = `${result.url} (HTTP ${result.status}${result.contentType ? `, ${result.contentType}` : ""})`;
  return `${header}\n\n${result.text.slice(0, maxChars)}${truncated ? "\n... [truncated]" : ""}`;
}
