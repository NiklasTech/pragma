export type ColumnKey = "sha" | "subject" | "author" | "date" | "changes";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "right";
}

export const ALL_COLUMNS: ColumnDef[] = [
  { key: "sha", label: "SHA", align: "left" },
  { key: "subject", label: "Subject", align: "left" },
  { key: "author", label: "Author", align: "left" },
  { key: "date", label: "Date", align: "right" },
  { key: "changes", label: "Δ", align: "right" },
];
