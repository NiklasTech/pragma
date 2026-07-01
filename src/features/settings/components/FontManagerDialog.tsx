"use client";

import { useState } from "react";
import { DownloadSimple, Trash, UploadSimple, Spinner, Check } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useFontStore } from "@/shared/stores/fonts";
import { FONT_CATALOG } from "@/shared/lib/fonts/catalog";

interface FontManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FontManagerDialog({ open, onOpenChange }: FontManagerDialogProps) {
  const fonts = useFontStore((s) => s.fonts);
  const downloads = useFontStore((s) => s.downloads);
  const downloadFont = useFontStore((s) => s.downloadFont);
  const importFontFile = useFontStore((s) => s.importFontFile);
  const deleteFont = useFontStore((s) => s.deleteFont);
  const [activeTab, setActiveTab] = useState("catalog");

  const installedIds = new Set(fonts.map((f) => f.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-4 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-4 pt-4">
          <DialogTitle className="text-ui-base">Font Manager</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col px-4 pb-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="installed">Installed</TabsTrigger>
          </TabsList>

          <TabsContent
            value="catalog"
            className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-ui-xs text-fg-muted">Download open-source monospace fonts</span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => void importFontFile()}
                className="gap-1"
              >
                <UploadSimple size={14} />
                Import file
              </Button>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {FONT_CATALOG.map((entry) => {
                const state = downloads[entry.id];
                const isInstalled = installedIds.has(entry.id);
                const isDownloading = state?.status === "downloading";
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-bg-root px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-ui-sm font-medium text-fg-default">{entry.name}</div>
                      <div className="text-ui-xs text-fg-muted">{entry.license}</div>
                    </div>
                    {isInstalled ? (
                      <span className="flex items-center gap-1 text-ui-xs text-status-success">
                        <Check size={14} />
                        Installed
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={isDownloading}
                        onClick={() => void downloadFont(entry)}
                        className="gap-1 shrink-0"
                      >
                        {isDownloading ? (
                          <>
                            <Spinner size={14} className="animate-spin" />
                            Downloading…
                          </>
                        ) : (
                          <>
                            <DownloadSimple size={14} />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent
            value="installed"
            className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
          >
            <div className="text-ui-xs text-fg-muted">
              {fonts.length === 0
                ? "No custom fonts installed yet."
                : `${fonts.length} font(s) installed`}
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {fonts.map((font) => (
                <div
                  key={font.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-bg-root px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-ui-sm font-medium text-fg-default">{font.name}</div>
                    <div className="text-ui-xs text-fg-muted capitalize">
                      {font.source} • {font.files.length} file(s)
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void deleteFont(font.id)}
                    title="Delete font"
                    className="text-status-error hover:text-status-error"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
