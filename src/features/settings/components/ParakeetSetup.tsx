"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle, DownloadSimple, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { unlistenQuietly } from "@/shared/lib/unlisten";

interface ParakeetStatus {
  supported: boolean;
  installed: boolean;
  downloading: boolean;
  downloadBytes: number;
}

interface DownloadProgress {
  received: number;
  total: number;
}

const CANCELLED = "Download cancelled";
const STATUS_POLL_MS = 1500;

function megabytes(bytes: number): number {
  return Math.round(bytes / 1_000_000);
}

export function ParakeetSetup() {
  const [status, setStatus] = React.useState<ParakeetStatus | null>(null);
  const [installing, setInstalling] = React.useState(false);
  const [progress, setProgress] = React.useState<DownloadProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refreshStatus = React.useCallback(async () => {
    try {
      setStatus(await invoke<ParakeetStatus>("parakeet_status"));
    } catch {
      setStatus(null);
    }
  }, []);

  React.useEffect(() => {
    void refreshStatus();
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen<DownloadProgress>("parakeet-download-progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
      if (disposed) void unlistenQuietly(fn);
    });
    return () => {
      disposed = true;
      void unlistenQuietly(unlisten);
    };
  }, [refreshStatus]);

  const downloadingElsewhere = Boolean(status?.downloading) && !installing;
  React.useEffect(() => {
    if (!downloadingElsewhere) return;
    const timer = window.setInterval(() => void refreshStatus(), STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [downloadingElsewhere, refreshStatus]);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    setProgress(null);
    try {
      await invoke("parakeet_download");
    } catch (err) {
      const message = String(err);
      if (message !== CANCELLED) setError(message);
    } finally {
      setInstalling(false);
      setProgress(null);
      await refreshStatus();
    }
  };

  const handleCancel = () => {
    void invoke("parakeet_cancel_download").catch(() => undefined);
  };

  if (!status) return null;

  if (!status.supported) {
    return (
      <div className="py-2.5">
        <span className="text-ui-xs text-status-error">
          Parakeet is not available on this platform. Web Speech keeps working.
        </span>
      </div>
    );
  }

  const downloading = installing || status.downloading;
  const received = progress?.received ?? 0;
  const total = progress?.total ?? status.downloadBytes;
  const percent = total > 0 ? Math.min(100, (received / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 py-2.5">
      {status.installed && !downloading && (
        <span className="flex items-center gap-1 text-ui-xs text-status-success">
          <CheckCircle size={14} /> Parakeet installed
        </span>
      )}
      {!status.installed && !downloading && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleInstall()}>
            <DownloadSimple size={14} className="mr-1" />
            Install
          </Button>
          <span className="text-ui-xs text-fg-muted">
            Downloads about {megabytes(status.downloadBytes)} MB (speech model and ONNX Runtime).
          </span>
        </div>
      )}
      {downloading && (
        <div className="flex flex-col gap-2">
          <Progress value={percent} aria-label="Parakeet download progress" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui-xs text-fg-muted tabular-nums">
              {megabytes(received)} of {megabytes(total)} MB
            </span>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <span className="text-ui-xs text-status-error">{error}</span>}
    </div>
  );
}
