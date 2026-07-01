export type FontSource = "builtin" | "download" | "local";

export interface FontFileEntry {
  weight: number;
  style: "normal" | "italic";
  path: string;
}

export interface FontConfig {
  id: string;
  name: string;
  source: FontSource;
  category: "monospace";
  files: FontFileEntry[];
}

export interface FontCatalogEntry {
  id: string;
  name: string;
  license: string;
  url: string;
  files: { weight: number; style: "normal" | "italic"; filename: string }[];
}

export interface DownloadFontRequest {
  id: string;
  name: string;
  url: string;
  files: { weight: number; style: "normal" | "italic"; filename: string }[];
}
