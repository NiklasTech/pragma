"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowSquareOut,
  ArrowsIn,
  File,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import type { PreviewTab } from "@/shared/stores/editor";

import { formatBytes, nextZoom, type Zoom } from "./zoom";

interface FilePreview {
  kind: "image" | "binary";
  size: number;
  mime: string | null;
  dataUrl: string | null;
}

export function FilePreviewView({ tab }: { tab: PreviewTab }) {
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setError(null);
    setDimensions(null);
    invoke<FilePreview>("read_file_preview", { path: tab.path })
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [tab.path]);

  const openExternally = () => {
    invoke("open_with_default_app", { path: tab.path }).catch((err: unknown) =>
      toast.error(String(err)),
    );
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-bg-root px-6 text-center text-ui-sm text-status-error">
        {error}
      </div>
    );
  }

  if (!preview) return <div className="h-full bg-bg-root" />;

  if (preview.kind === "binary" || !preview.dataUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg-root px-6 text-center">
        <File size={32} className="text-fg-subtle" />
        <div className="flex flex-col gap-1">
          <span className="text-ui-sm font-medium text-fg-default">{tab.name}</span>
          <span className="text-ui-xs text-fg-muted">
            Binary file, {formatBytes(preview.size)}. It cannot be shown as text.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={openExternally}>
          <ArrowSquareOut size={13} />
          Open with system default app
        </Button>
      </div>
    );
  }

  const scale = zoom === "fit" ? null : zoom;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-root">
      <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle px-2 py-1 text-ui-xs text-fg-muted">
        <span className="tabular-nums">
          {dimensions ? `${dimensions.width} x ${dimensions.height} px, ` : ""}
          {formatBytes(preview.size)}
        </span>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => setZoom((current) => nextZoom(current, -1))}
        >
          <MagnifyingGlassMinus size={13} />
        </Button>
        <span className="w-12 text-center tabular-nums">
          {scale === null ? "Fit" : `${Math.round(scale * 100)}%`}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom((current) => nextZoom(current, 1))}
        >
          <MagnifyingGlassPlus size={13} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fit to window"
          title="Fit to window"
          onClick={() => setZoom("fit")}
        >
          <ArrowsIn size={13} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>
          100%
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <img
          src={preview.dataUrl}
          alt={tab.name}
          draggable={false}
          onLoad={(event) =>
            setDimensions({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          className={scale === null ? "max-h-full max-w-full object-contain" : "max-w-none"}
          style={
            scale !== null && dimensions
              ? { width: dimensions.width * scale, height: dimensions.height * scale }
              : undefined
          }
        />
      </div>
    </div>
  );
}
