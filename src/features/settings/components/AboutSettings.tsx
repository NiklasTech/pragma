"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { SettingSection } from "./ui/SettingSection";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import {
  GithubLogo,
  ArrowSquareOut,
  Copy,
  Check,
  Spinner,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

const GITHUB_OWNER = "NiklasTech";
const GITHUB_REPO = "pragma";
const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "available"; version: string; url: string }
  | { state: "error"; message: string };

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

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => !Number.isNaN(n));
}

function compareVersions(a: string, b: string): number {
  const partsA = parseVersion(a);
  const partsB = parseVersion(b);
  const maxLength = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLength; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function AboutSettings() {
  const [version, setVersion] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>({ state: "idle" });
  const [licenses, setLicenses] = React.useState<LicenseEntry[]>([]);
  const [licensesLoading, setLicensesLoading] = React.useState(true);
  const [licensesError, setLicensesError] = React.useState<string | null>(null);

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

  const handleCheckForUpdates = async () => {
    if (!version) return;
    setUpdateStatus({ state: "checking" });
    try {
      const response = await fetch(LATEST_RELEASE_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (response.status === 404) {
        setUpdateStatus({ state: "error", message: "No releases found yet." });
        return;
      }
      if (!response.ok) {
        setUpdateStatus({ state: "error", message: "Unable to check for updates." });
        return;
      }
      const data = (await response.json()) as { tag_name?: string; html_url?: string };
      const latest = data.tag_name ?? "";
      const url = data.html_url ?? RELEASES_URL;
      if (!latest) {
        setUpdateStatus({ state: "error", message: "No release version found." });
        return;
      }
      if (compareVersions(latest, version) > 0) {
        setUpdateStatus({ state: "available", version: latest, url });
      } else {
        setUpdateStatus({ state: "up-to-date" });
      }
    } catch {
      setUpdateStatus({ state: "error", message: "Network error while checking for updates." });
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
            Check GitHub for the latest release notes and downloads.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleCheckForUpdates}
              disabled={updateStatus.state === "checking" || !version}
            >
              {updateStatus.state === "checking" ? (
                <Spinner size={14} className="mr-1 animate-spin" />
              ) : (
                <ArrowSquareOut size={14} className="mr-1" />
              )}
              {updateStatus.state === "checking" ? "Checking..." : "Check for Updates"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenUrl(REPO_URL)}>
              <GithubLogo size={14} className="mr-1" />
              View on GitHub
            </Button>
          </div>

          {updateStatus.state === "up-to-date" && (
            <div className="flex items-center gap-1.5 text-ui-xs text-status-success">
              <CheckCircle size={14} />
              You are running the latest version.
            </div>
          )}

          {updateStatus.state === "available" && (
            <div className="flex flex-col gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
              <div className="flex items-center gap-1.5 text-ui-xs text-status-warning">
                <WarningCircle size={14} />
                Version {updateStatus.version} is available.
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenUrl(updateStatus.url)}
                className="w-fit"
              >
                <ArrowSquareOut size={14} className="mr-1" />
                Download {updateStatus.version}
              </Button>
            </div>
          )}

          {updateStatus.state === "error" && (
            <div className="flex items-center gap-1.5 text-ui-xs text-status-error">
              <WarningCircle size={14} />
              {updateStatus.message}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
}
