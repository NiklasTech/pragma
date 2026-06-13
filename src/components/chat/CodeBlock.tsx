import { useCallback, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language?: string;
  value: string;
  className?: string;
}

export function CodeBlock({ language, value, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors.
    }
  }, [value]);

  return (
    <div
      className={cn(
        "my-3 overflow-hidden rounded-lg border border-border/60 bg-muted/80",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/40 bg-muted px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {language ?? "text"}
        </span>
        <Button type="button" variant="ghost" size="icon-xs" onClick={handleCopy} title="Copy code">
          {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language ?? "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "transparent",
          padding: "0.75rem 1rem",
          fontSize: "12px",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
