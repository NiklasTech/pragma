import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as log from "@tauri-apps/plugin-log";

export interface MemoryStats {
  residentSetSizeBytes: number;
}

const POLL_INTERVAL_MS = 30_000;

export function useMemoryStats(enabled: boolean = true): void {
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabledRef.current) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    const logStats = async () => {
      if (running) return;
      running = true;

      try {
        const stats = await invoke<MemoryStats>("memory_stats");
        await log.info(
          `Memory stats: RSS=${stats.residentSetSizeBytes} bytes (${(stats.residentSetSizeBytes / 1024 / 1024).toFixed(1)} MB)`,
        );
      } catch (error) {
        await log.error(`Failed to fetch memory stats: ${String(error)}`);
      } finally {
        running = false;
      }

      if (!cancelled) {
        timeoutId = setTimeout(logStats, POLL_INTERVAL_MS);
      }
    };

    void logStats();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
}
