/// Encodings offered for reopening and saving; values are WHATWG names as Rust reports them.
export const FILE_ENCODINGS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "UTF-8", label: "UTF-8" },
  { value: "UTF-16LE", label: "UTF-16 LE" },
  { value: "UTF-16BE", label: "UTF-16 BE" },
  { value: "windows-1252", label: "Western (Windows 1252, Latin-1)" },
  { value: "ISO-8859-15", label: "Western (ISO 8859-15)" },
  { value: "ISO-8859-2", label: "Central European (ISO 8859-2)" },
  { value: "windows-1250", label: "Central European (Windows 1250)" },
  { value: "windows-1251", label: "Cyrillic (Windows 1251)" },
  { value: "KOI8-R", label: "Cyrillic (KOI8-R)" },
  { value: "Shift_JIS", label: "Japanese (Shift JIS)" },
  { value: "EUC-JP", label: "Japanese (EUC-JP)" },
  { value: "GBK", label: "Chinese Simplified (GBK)" },
  { value: "Big5", label: "Chinese Traditional (Big5)" },
  { value: "EUC-KR", label: "Korean (EUC-KR)" },
];

/// Short status bar label: the WHATWG name, with the friendlier spelling for UTF-16.
export function encodingLabel(encoding: string | undefined): string {
  if (!encoding) return "UTF-8";
  if (encoding === "UTF-16LE") return "UTF-16 LE";
  if (encoding === "UTF-16BE") return "UTF-16 BE";
  return encoding;
}
