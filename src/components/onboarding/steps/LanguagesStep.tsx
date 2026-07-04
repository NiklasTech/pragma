import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  LSP_SERVERS,
  isLspAutoInstallable,
  isLspSupported,
  type LspServerDefinition,
} from "@/shared/lib/lsp-servers";
import { Copy, Check, ArrowClockwise, DownloadSimple } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

interface ProjectLanguage {
  language: string;
  percentage: number;
}

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

function getServerDisplay(definition: LspServerDefinition, language: string): string {
  const labels: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    rust: "Rust",
    python: "Python",
    go: "Go",
    java: "Java",
    c: "C",
    cpp: "C++",
    html: "HTML",
    css: "CSS",
  };
  return labels[language] ?? definition.displayName;
}

export function LanguagesStep() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const { lsp, setLspEnabled, experimental, setExperimentalEnabled } = useSettingsStore();
  const [languages, setLanguages] = React.useState<ProjectLanguage[]>([]);
  const [statuses, setStatuses] = React.useState<Record<string, ServerStatus>>({});
  const [installing, setInstalling] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const detectLanguages = React.useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const detected = await invoke<ProjectLanguage[]>("lsp_detect_project_languages", {
        projectRoot: rootPath,
      });
      const filtered = detected.filter(
        (item) => item.percentage >= 5 && isLspSupported(item.language),
      );
      setLanguages(filtered);

      for (const item of filtered) {
        setStatuses((prev) => ({ ...prev, [item.language]: "checking" }));
        try {
          const installed = await invoke<boolean>("lsp_check_server", {
            language: item.language,
          });
          setStatuses((prev) => ({
            ...prev,
            [item.language]: installed ? "installed" : "missing",
          }));
        } catch {
          setStatuses((prev) => ({ ...prev, [item.language]: "error" }));
        }
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  React.useEffect(() => {
    void detectLanguages();
  }, [detectLanguages]);

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

  const handleRecheck = async (language: string) => {
    setStatuses((prev) => ({ ...prev, [language]: "checking" }));
    try {
      const installed = await invoke<boolean>("lsp_check_server", { language });
      setStatuses((prev) => ({
        ...prev,
        [language]: installed ? "installed" : "missing",
      }));
    } catch {
      setStatuses((prev) => ({ ...prev, [language]: "error" }));
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
      await handleRecheck(language);
    } catch (err) {
      toast.error(String(err));
      setStatuses((prev) => ({ ...prev, [language]: "missing" }));
    } finally {
      setInstalling((prev) => ({ ...prev, [language]: false }));
    }
  };

  if (!experimental.lsp) {
    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-fg-default">Language servers</h2>
          <p className="text-ui-sm text-fg-muted">
            Language server support is currently experimental and disabled. You can enable it below
            or later in Settings → Languages.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setExperimentalEnabled("lsp", true)}
          className="self-center"
        >
          Enable experimental language servers
        </Button>
      </div>
    );
  }

  if (loading && languages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-ui-sm text-fg-muted">Scanning project languages...</p>
      </div>
    );
  }

  if (languages.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-fg-default">Language servers</h2>
          <p className="text-ui-sm text-fg-muted">
            No supported languages were detected in this project. You can still enable language
            servers later in Settings → Languages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-fg-default">Set up language servers</h2>
        <p className="text-ui-sm text-fg-muted">
          We detected the following languages in your project. Enable the ones you want Pragma to
          analyze and install any missing servers.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {languages.map(({ language, percentage }) => {
          const definition = LSP_SERVERS[language];
          const status = statuses[language] ?? "checking";
          const isInstalled = status === "installed";
          const enabled = lsp.enabled[language] ?? false;

          return (
            <div
              key={language}
              className="flex flex-col gap-2 rounded-md border border-border/30 bg-bg-root p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", STATUS_COLORS[status])}
                    title={STATUS_LABELS[status]}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-ui-sm font-medium text-fg-default">
                      {getServerDisplay(definition, language)}
                    </span>
                    <span className="text-ui-xs text-fg-subtle">
                      {percentage.toFixed(0)}% of project · {STATUS_LABELS[status]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isInstalled && status !== "checking" && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Recheck"
                      onClick={() => handleRecheck(language)}
                    >
                      <ArrowClockwise size={14} />
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
                <div className="flex flex-col gap-2 rounded-md border border-border/30 bg-bg-surface p-2">
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
    </div>
  );
}
