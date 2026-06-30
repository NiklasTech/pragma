"use client";

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import { LSP_SERVERS, isLspAutoInstallable, listLspLanguages } from "@/shared/lib/lsp-servers";
import { SettingSection } from "./ui/SettingSection";
import { ArrowClockwise, Copy, Check, Globe, DownloadSimple } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

type ServerStatus = "checking" | "installed" | "missing" | "error";

const STATUS_COLORS: Record<ServerStatus, string> = {
  checking: "bg-status-warning",
  installed: "bg-status-success",
  missing: "bg-status-error",
  error: "bg-status-error",
};

const STATUS_LABELS: Record<ServerStatus, string> = {
  checking: "Checking...",
  installed: "Installed",
  missing: "Not installed",
  error: "Error",
};

export function LspSettings() {
  const { lsp, setLspEnabled, experimental, setExperimentalEnabled } = useSettingsStore();
  const [statuses, setStatuses] = React.useState<Record<string, ServerStatus>>({});
  const [installing, setInstalling] = React.useState<Record<string, boolean>>({});
  const [copied, setCopied] = React.useState<string | null>(null);

  const languages = React.useMemo(() => listLspLanguages(), []);

  const checkServer = React.useCallback(async (language: string) => {
    setStatuses((prev) => ({ ...prev, [language]: "checking" }));
    try {
      const installed = await invoke<boolean>("lsp_check_server", { language });
      setStatuses((prev) => ({ ...prev, [language]: installed ? "installed" : "missing" }));
    } catch (err) {
      console.error(`[LSP Check ${language}]`, err);
      setStatuses((prev) => ({ ...prev, [language]: "error" }));
    }
  }, []);

  const checkAll = React.useCallback(() => {
    for (const language of languages) {
      void checkServer(language);
    }
  }, [languages, checkServer]);

  React.useEffect(() => {
    checkAll();
  }, [checkAll]);

  const handleCopy = async (language: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(language);
      toast.success("Install command copied to clipboard");
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleInstall = async (language: string) => {
    setInstalling((prev) => ({ ...prev, [language]: true }));
    setStatuses((prev) => ({ ...prev, [language]: "checking" }));
    try {
      const output = await invoke<string>("lsp_install_server", { language });
      toast.success(`Installed ${LSP_SERVERS[language].displayName}`, {
        description: output || undefined,
      });
      await checkServer(language);
    } catch (err) {
      toast.error(String(err));
      setStatuses((prev) => ({ ...prev, [language]: "missing" }));
    } finally {
      setInstalling((prev) => ({ ...prev, [language]: false }));
    }
  };

  const handleOpenHomepage = (url?: string) => {
    if (!url) return;
    void invoke("open_external_url", { url });
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingSection
        title="Language Servers"
        badge={{ label: "Experimental", variant: "warning" }}
      >
        <div className="mb-3 flex items-center justify-between rounded-md border border-border/30 bg-bg-root p-3">
          <div className="flex flex-col">
            <span className="text-ui-sm font-medium text-fg-default">Enable language servers</span>
            <span className="text-ui-xs text-fg-muted">
              Turn on experimental LSP support for diagnostics.
            </span>
          </div>
          <Switch
            checked={experimental.lsp}
            onCheckedChange={(v) => setExperimentalEnabled("lsp", v)}
            aria-label="Enable experimental language servers"
          />
        </div>

        <div className="mb-2 flex justify-end">
          <Button size="xs" variant="outline" onClick={checkAll} className="gap-1">
            <ArrowClockwise size={14} />
            Refresh status
          </Button>
        </div>

        <p className="mb-3 text-ui-xs text-fg-muted">
          Enable the languages you want Pragma to analyze. Missing servers can be installed with the
          command shown below.
        </p>

        {!experimental.lsp && (
          <p className="text-ui-xs text-status-warning">
            Language servers are currently disabled. Enable the toggle above to use them.
          </p>
        )}

        <div className="flex flex-col">
          {languages.map((language) => {
            const definition = LSP_SERVERS[language];
            const enabled = lsp.enabled[language] ?? false;
            const status = statuses[language] ?? "checking";
            const isInstalled = status === "installed";

            return (
              <div
                key={language}
                className="flex flex-col gap-2 border-b border-border/30 py-3 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", STATUS_COLORS[status])}
                      title={STATUS_LABELS[status]}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-ui-sm font-medium text-fg-default">
                        {definition.displayName}
                      </span>
                      <span className="text-ui-xs text-fg-subtle">
                        {STATUS_LABELS[status]}
                        {definition.requiredRuntime && ` · requires ${definition.requiredRuntime}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {definition.homepage && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Open homepage"
                        onClick={() => handleOpenHomepage(definition.homepage)}
                      >
                        <Globe size={14} />
                      </Button>
                    )}
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => setLspEnabled(language, v)}
                      aria-label={`Enable ${definition.displayName}`}
                    />
                  </div>
                </div>

                {!isInstalled && (
                  <div className="flex flex-col gap-2 rounded-md border border-border/30 bg-bg-root p-2">
                    <div className="flex items-start gap-2">
                      <code className="flex-1 whitespace-pre-wrap break-all font-mono text-ui-xs text-fg-muted">
                        {definition.installCommand}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Copy install command"
                        onClick={() => handleCopy(language, definition.installCommand)}
                      >
                        {copied === language ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                    {isLspAutoInstallable(language) && (
                      <Button
                        size="xs"
                        variant="secondary"
                        className="min-w-[120px] justify-center gap-1 self-start"
                        disabled={installing[language]}
                        onClick={() => handleInstall(language)}
                      >
                        {installing[language] ? (
                          <>
                            <ArrowClockwise size={14} className="animate-spin" />
                            Install
                          </>
                        ) : (
                          <>
                            <DownloadSimple size={14} />
                            Install
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingSection>
    </div>
  );
}
