"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { SettingSection } from "./ui/SettingSection";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import {
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  CheckCircle,
  Copy,
  DownloadSimple,
  GithubLogo,
  Spinner,
  WarningCircle,
} from "@phosphor-icons/react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Progress } from "@/shared/components/ui/progress";
import { useUpdaterStore } from "@/features/settings/updater/updaterStore";

const GITHUB_OWNER = "NiklasTech";
const GITHUB_REPO = "pragma";
const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  url: string;
  source: "npm" | "rust";
}

interface LicensesData {
  generatedAt: string;
  total: number;
  entries: LicenseEntry[];
}

export function AboutSettings() {
  const [version, setVersion] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [licenses, setLicenses] = React.useState<LicenseEntry[]>([]);
  const [licensesLoading, setLicensesLoading] = React.useState(true);
  const [licensesError, setLicensesError] = React.useState<string | null>(null);

  const updaterState = useUpdaterStore((s) => s.state);
  const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);
  const restartApp = useUpdaterStore((s) => s.restartApp);

  React.useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  React.useEffect(() => {
    fetch("/third-party-licenses.json")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load licenses");
        const data = (await res.json()) as LicensesData;
        setLicenses(data.entries);
      })
      .catch((err: unknown) => {
        setLicensesError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLicensesLoading(false);
      });
  }, []);

  const handleOpenUrl = (url: string) => {
    void invoke("open_external_url", { url });
  };

  const handleCopyVersion = async () => {
    if (!version) return;
    try {
      await navigator.clipboard.writeText(version);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Application">
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <img
              src="/pragma_logo.svg"
              alt="Pragma logo"
              className="h-12 w-12 rounded-lg bg-bg-surface p-1.5"
            />
            <div className="flex flex-col">
              <span className="font-heading text-sm font-semibold text-fg-default">Pragma</span>
              <span className="text-ui-xs text-fg-muted">Local-first AI coding environment</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/30 bg-bg-root px-3 py-2">
            <div className="flex flex-col">
              <span className="text-ui-sm text-fg-default">Version</span>
              <span className="font-mono text-ui-xs text-fg-muted">{version ?? "Loading..."}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyVersion}
              disabled={!version}
              className="gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Legal">
        <div className="flex flex-col gap-3 py-2">
          <p className="text-ui-xs text-fg-muted">
            © {new Date().getFullYear()}{" "}
            <button
              type="button"
              onClick={() => handleOpenUrl(`https://github.com/${GITHUB_OWNER}`)}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {GITHUB_OWNER}
              <ArrowSquareOut size={10} />
            </button>
            . All rights reserved.
          </p>
          <p className="text-ui-xs text-fg-muted">
            Pragma is licensed under the{" "}
            <button
              type="button"
              onClick={() => handleOpenUrl(`${REPO_URL}/blob/main/LICENSE`)}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Apache License 2.0
              <ArrowSquareOut size={10} />
            </button>
            .
          </p>
          <p className="text-ui-xs text-fg-muted">
            Pragma wraps official provider CLI tools that run locally on your machine. It does not
            provide models, accounts, credentials, or OAuth flows. Third-party CLI tools are
            published by their respective owners under their own licenses.
          </p>
        </div>
      </SettingSection>

      <SettingSection title="Third-Party Licenses">
        <div className="flex flex-col gap-3 py-2">
          <p className="text-ui-xs text-fg-muted">
            Pragma builds on many open-source projects. This list was generated automatically from
            the npm and Rust dependencies.
          </p>

          {licensesLoading && (
            <div className="flex items-center gap-2 text-ui-xs text-fg-muted">
              <Spinner size={14} className="animate-spin" />
              <span>Loading licenses...</span>
            </div>
          )}

          {licensesError && <div className="text-ui-xs text-status-error">{licensesError}</div>}

          {!licensesLoading && !licensesError && (
            <div className="rounded-md border border-border/30 bg-bg-root">
              <ScrollArea className="h-64">
                <ul className="divide-y divide-border/30">
                  {licenses.map((entry) => (
                    <li
                      key={`${entry.source}:${entry.name}@${entry.version}`}
                      className="flex items-center justify-between gap-3 px-3 py-1.5 text-ui-xs"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-fg-default">
                          {entry.name} <span className="text-fg-muted">{entry.version}</span>
                        </span>
                        <span className="truncate text-fg-subtle">{entry.license}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenUrl(entry.url)}
                        className="shrink-0 text-fg-muted hover:text-fg-default"
                        aria-label={`Open registry page for ${entry.name}`}
                      >
                        <ArrowSquareOut size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>
      </SettingSection>

      <SettingSection title="Updates">
        <div className="flex flex-col gap-3 py-2">
          <p className="text-ui-xs text-fg-muted">
            Check for updates and install them directly from here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void checkForUpdates()}
              disabled={updaterState.status === "checking" || updaterState.status === "downloading"}
            >
              {updaterState.status === "checking" ? (
                <Spinner size={14} className="mr-1 animate-spin" />
              ) : (
                <ArrowClockwise size={14} className="mr-1" />
              )}
              {updaterState.status === "checking" ? "Checking..." : "Check for Updates"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenUrl(REPO_URL)}>
              <GithubLogo size={14} className="mr-1" />
              View on GitHub
            </Button>
          </div>

          {updaterState.status === "up-to-date" && (
            <div className="flex items-center gap-1.5 text-ui-xs text-status-success">
              <CheckCircle size={14} />
              You are running the latest version.
            </div>
          )}

          {updaterState.status === "available" && (
            <div className="flex flex-col gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
              <div className="flex items-center gap-1.5 text-ui-xs text-status-warning">
                <WarningCircle size={14} />
                Version {updaterState.version} is available.
              </div>
              {updaterState.notes && (
                <p className="text-ui-xs whitespace-pre-wrap text-fg-muted">{updaterState.notes}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void downloadAndInstall()}
                className="w-fit"
              >
                <DownloadSimple size={14} className="mr-1" />
                Install Update
              </Button>
            </div>
          )}

          {updaterState.status === "downloading" && (
            <div className="flex flex-col gap-2 rounded-md border border-border/30 bg-bg-root p-3">
              <span className="text-ui-xs text-fg-muted">
                Downloading update... {updaterState.progress}%
              </span>
              <Progress value={updaterState.progress} />
            </div>
          )}

          {updaterState.status === "ready-to-restart" && (
            <div className="flex flex-col gap-2 rounded-md border border-status-success/30 bg-status-success/10 p-3">
              <div className="flex items-center gap-1.5 text-ui-xs text-status-success">
                <CheckCircle size={14} />
                Version {updaterState.version} was installed. Restart to finish.
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void restartApp()}
                className="w-fit"
              >
                <ArrowClockwise size={14} className="mr-1" />
                Restart
              </Button>
            </div>
          )}

          {updaterState.status === "error" && (
            <div className="flex items-center gap-1.5 text-ui-xs text-status-error">
              <WarningCircle size={14} />
              {updaterState.message}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
}
