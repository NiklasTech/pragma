import { create } from "zustand";
import type { RunConfig } from "@/shared/stores/runConfig";

export type AttachAdapter = "node" | "python" | "java" | "lldb";

export interface AttachAdapterOption {
  id: AttachAdapter;
  label: string;
  defaultPort?: number;
}

export const ATTACH_ADAPTERS: AttachAdapterOption[] = [
  { id: "node", label: "Node.js (--inspect)", defaultPort: 9229 },
  { id: "python", label: "Python (debugpy)", defaultPort: 5678 },
  { id: "java", label: "Java (JDWP)", defaultPort: 5005 },
  { id: "lldb", label: "Native process (lldb)" },
];

export const DEFAULT_ATTACH_HOST = "localhost";

export function isAttachAdapter(value: unknown): value is AttachAdapter {
  return ATTACH_ADAPTERS.some((adapter) => adapter.id === value);
}

/** A TCP port from user input, or null when it is not an integer in 1-65535. */
export function parsePort(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const port = Number(trimmed);
  return port >= 1 && port <= 65535 ? port : null;
}

export function portAttachConfig(adapter: AttachAdapter, host: string, port: number): RunConfig {
  const targetHost = host.trim() || DEFAULT_ATTACH_HOST;
  return {
    name: `Attach to ${targetHost}:${port}`,
    command: "",
    env: {},
    autostart: false,
    autoRestart: false,
    debug: { adapter, request: "attach", host: targetHost, port },
  };
}

export function processAttachConfig(processId: number, processName: string): RunConfig {
  return {
    name: `Attach to ${processName} (${processId})`,
    command: "",
    env: {},
    autostart: false,
    autoRestart: false,
    debug: { adapter: "lldb", request: "attach", processId },
  };
}

interface AttachDialogState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useAttachDialogStore = create<AttachDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
