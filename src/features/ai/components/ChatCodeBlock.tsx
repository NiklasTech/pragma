"use client";

import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Terminal } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { injectIntoActivePty } from "@/shared/lib/terminal";
import { Shimmer } from "./Shimmer";
import { highlight, isHighlightable, type HighlightedNode } from "./chat-code-lezer";

const StreamingCtx = createContext(false);
export const ChatStreamingProvider = StreamingCtx.Provider;

const POSIX_SHELL = new Set(["bash", "sh", "zsh", "shell", "console", "shellscript"]);
const WINDOWS_SHELL = new Set(["powershell", "pwsh", "ps1", "ps", "cmd", "bat", "batch"]);
const SHELL_LANGS = new Set([...POSIX_SHELL, ...WINDOWS_SHELL]);

function shellPrompt(lang: string): string {
  if (WINDOWS_SHELL.has(lang)) {
    return lang === "cmd" || lang === "bat" || lang === "batch" ? ">" : "PS>";
  }
  return "$";
}

function normalizeLangLabel(raw: string): string {
  const lower = raw.toLowerCase();
  if (POSIX_SHELL.has(lower)) return "bash";
  if (lower === "pwsh" || lower === "ps1" || lower === "ps") return "powershell";
  if (lower === "bat" || lower === "batch") return "cmd";
  return lower || "text";
}

export type ChatCodeBlockProps = {
  code: string;
  lang: string | null;
};

export function ChatCodeBlock({ code, lang }: ChatCodeBlockProps) {
  const streaming = useContext(StreamingCtx);
  const label = normalizeLangLabel(lang ?? "");

  if (streaming) {
    return <GeneratingPlaceholder label={label} />;
  }

  if (SHELL_LANGS.has(label)) {
    return <CommandCard code={code} lang={label} />;
  }

  return <FinalizedCodeBlock code={code} lang={label} />;
}

function GeneratingPlaceholder({ label }: { label: string }) {
  return (
    <div className="not-prose my-2 flex items-center gap-2 rounded-sm border border-border bg-[color-mix(in_srgb,var(--bg-hover)_30%,transparent)] px-3 py-2 text-ui-xs text-fg-muted">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--fg-muted)_60%,transparent)]" />
      <Shimmer duration={1.2}>
        {label === "text" ? "Generating code…" : `Generating ${label}…`}
      </Shimmer>
    </div>
  );
}

function BlockChrome({
  label,
  code,
  children,
}: {
  label: string;
  code: string;
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose my-2 overflow-hidden rounded-sm border border-border bg-[color-mix(in_srgb,var(--bg-hover)_30%,transparent)]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-[color-mix(in_srgb,var(--bg-hover)_20%,transparent)] px-3 py-1">
        <span className="font-mono text-ui-xs uppercase tracking-wide text-fg-muted">{label}</span>
        <CopyButton text={code} />
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function FinalizedCodeBlock({ code, lang }: { code: string; lang: string }) {
  if (!isHighlightable(lang)) {
    return (
      <BlockChrome label={lang} code={code}>
        <pre className="m-0 px-3 py-2.5 font-mono text-ui-sm leading-relaxed text-fg-default">
          {code}
        </pre>
      </BlockChrome>
    );
  }

  return (
    <BlockChrome label={lang} code={code}>
      <HighlightedPre code={code} lang={lang} />
    </BlockChrome>
  );
}

const HighlightedPre = memo(function HighlightedPre({
  code,
  lang,
}: {
  code: string;
  lang: string;
}) {
  const [nodes, setNodes] = useState<HighlightedNode[] | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    let cancelled = false;

    highlight(code, lang)
      .then((result) => {
        if (cancelled || cancelRef.current) return;
        setNodes(result);
      })
      .catch(() => {
        if (cancelled) return;
        setNodes(null);
      });

    return () => {
      cancelled = true;
      cancelRef.current = true;
    };
  }, [code, lang]);

  if (!nodes) {
    return (
      <pre className="m-0 px-3 py-2.5 font-mono text-ui-sm leading-relaxed text-fg-default">
        {code}
      </pre>
    );
  }

  return (
    <pre className="m-0 px-3 py-2.5 font-mono text-ui-sm leading-relaxed text-fg-default">
      {nodes.map((node, index) =>
        node.kind === "break" ? (
          <span key={index}>{"\n"}</span>
        ) : (
          <span key={index} className={node.cls || undefined}>
            {node.value}
          </span>
        ),
      )}
    </pre>
  );
});

function CommandCard({ code, lang }: { code: string; lang: string }) {
  const isMultiline = code.includes("\n");
  const prompt = shellPrompt(lang);

  return (
    <div className="not-prose my-2 overflow-hidden rounded-sm border border-border bg-[color-mix(in_srgb,var(--bg-hover)_40%,transparent)]">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="font-mono text-ui-xs uppercase tracking-wide text-fg-muted">
          {normalizeLangLabel(lang)}
        </span>
        <div className="flex items-center gap-1">
          <RunInTerminalButton command={code} />
          <CopyButton text={code} />
        </div>
      </div>
      <div className="border-t border-border bg-[color-mix(in_srgb,var(--bg-root)_40%,transparent)]">
        <pre
          className={cn(
            "m-0 overflow-x-auto px-3 py-2 font-mono text-ui-sm leading-relaxed text-fg-default",
            isMultiline ? "whitespace-pre" : "whitespace-pre-wrap",
          )}
        >
          {code.split("\n").map((line, index) => (
            <span key={index} className="flex">
              <span className="mr-2 select-none text-[color-mix(in_srgb,var(--fg-muted)_70%,transparent)]">
                {prompt}
              </span>
              <span>{line}</span>
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}

function RunInTerminalButton({ command }: { command: string }) {
  const [sent, setSent] = useState(false);
  const timeoutRef = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const onRun = () => {
    const ok = injectIntoActivePty(command);
    if (!ok) return;
    setSent(true);
    timeoutRef.current = window.setTimeout(() => setSent(false), 1500);
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onRun}
      className="h-5 gap-1 rounded-sm px-1.5 text-ui-xs font-medium text-fg-muted outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.96]"
      aria-label="Run in active terminal"
      title="Run in active terminal"
    >
      {sent ? <Terminal size={11} weight="bold" /> : <ArrowRight size={11} weight="bold" />}
      <span>{sent ? "Sent" : "Run"}</span>
    </Button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const onCopy = async () => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors.
    }
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onCopy}
      className="size-5 shrink-0 rounded-sm text-fg-muted outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.92]"
      aria-label="Copy code"
      title="Copy code"
    >
      {copied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
    </Button>
  );
}
