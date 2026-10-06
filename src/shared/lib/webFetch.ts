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
