export type ConnectionTestStatus = "idle" | "loading" | "ok" | "error";

export interface ApiKeySaveStatus {
  type: "ok" | "error";
  message: string;
}
