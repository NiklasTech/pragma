"use client";

import { FileText, Globe } from "@phosphor-icons/react";

import { ActivityBlock } from "./ActivityBlock";

type SourceBlockProps = {
  type: "document" | "url" | "file";
  title: string;
  url?: string;
  filename?: string;
  streaming?: boolean;
};

export function SourceBlock({ type, title, url, filename, streaming = false }: SourceBlockProps) {
  const icon = type === "url" ? <Globe size={12} /> : <FileText size={12} />;
  const display = filename ?? title;

  return (
    <ActivityBlock
      icon={icon}
      title={
        <span>
          <span className="text-fg-muted">Reading</span>{" "}
          <span className="font-medium text-fg-default">{display}</span>
        </span>
      }
      streaming={streaming}
      defaultOpen={streaming}
    >
      <div className="text-ui-xs text-fg-muted">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {url}
          </a>
        )}
        {!url && <span>{title}</span>}
      </div>
    </ActivityBlock>
  );
}
