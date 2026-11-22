import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { isLspAutoInstallable, LSP_SERVERS } from "@/shared/lib/lsp-servers";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";

import type { ProjectLanguages, ServerStatus } from "./useProjectLanguages";

const CELL: Record<ServerStatus, string> = {
  checking: "bg-fg-subtle/40",
  installed: "bg-status-success",
  missing: "bg-status-warning",
  error: "bg-status-error",
};

const STATUS_TEXT: Record<ServerStatus, string> = {
  checking: "checking",
  installed: "ready",
  missing: "not installed",
  error: "error",
};

const LANGUAGE_NAMES: Record<string, string> = {
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
  shell: "Shell",
  ruby: "Ruby",
  toml: "TOML",
  csharp: "C#",
  swift: "Swift",
  zig: "Zig",
};

function Message({ children }: { children: string }) {
  return (
    <p className="m-auto max-w-[280px] text-center text-ui-sm leading-relaxed text-fg-subtle">
      {children}
    </p>
  );
}

/// The language servers the open folder needs, with the command that installs a missing one.
export function LanguagesBlock({ project }: { project: ProjectLanguages }) {
  const setExperimentalEnabled = useSettingsStore((state) => state.setExperimentalEnabled);
  const [copied, setCopied] = useState<string | null>(null);
  const { state, languages, statuses, installing } = project;

  const copy = async (language: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(language);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error(String(err));
    }
  };

  if (state.kind === "off") {
    return (
      <div className="m-auto flex flex-col items-center gap-3">
        <Message>Language servers are turned off.</Message>
        <Button variant="outline" size="sm" onClick={() => setExperimentalEnabled("lsp", true)}>
          Turn on
        </Button>
      </div>
    );
  }
  if (state.kind === "no-folder") {
    return <Message>Pragma checks the languages of your folder once one is open.</Message>;
  }
  if (state.kind === "checking" && languages.length === 0) {
    return <Message>Looking at the folder…</Message>;
  }
  if (state.kind === "done" && state.found === 0) {
    return <Message>No language here needs a language server.</Message>;
  }

  return (
    <div className="flex flex-col gap-2">
      {languages.map(({ language }) => {
        const definition = LSP_SERVERS[language];
        const status = statuses[language] ?? "checking";
        return (
          <div key={language} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5 text-ui-sm">
              <span
                aria-hidden="true"
                className={cn("size-[9px] shrink-0 rounded-[2px]", CELL[status])}
              />
              <span className="w-24 shrink-0 font-medium text-fg-default">
                {LANGUAGE_NAMES[language] ?? definition.displayName}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-ui-2xs text-fg-muted">
                {definition.command}
              </span>
              <span
                className={cn(
                  "font-mono text-ui-2xs",
                  status === "installed" ? "text-status-success" : "text-status-warning",
                )}
              >
                {STATUS_TEXT[status]}
              </span>
            </div>
            {(status === "missing" || status === "error") && (
              <div className="ml-[19px] flex items-center gap-1.5 rounded-control bg-bg-input py-1 pr-1 pl-2.5 ring-1 ring-border-subtle ring-inset">
                <span className="font-mono text-ui-xs text-primary">$</span>
                <code className="min-w-0 flex-1 truncate font-mono text-ui-2xs text-fg-default">
                  {definition.installCommand}
                </code>
                <IconButton
                  icon={copied === language ? Check : Copy}
                  label="Copy install command"
                  onClick={() => void copy(language, definition.installCommand)}
                />
                {isLspAutoInstallable(language) && (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={installing[language]}
                    onClick={() => void project.install(language)}
                  >
                    {installing[language] ? "Installing" : "Install"}
                  </Button>
                )}
                <Button size="xs" variant="outline" onClick={() => void project.recheck(language)}>
                  Check
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
