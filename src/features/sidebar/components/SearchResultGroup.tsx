import { useState } from "react";
import { ArrowsLeftRight, CaretRight } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { cn } from "@/shared/lib/utils";
import type { SearchResult, SearchResultGroup } from "@/features/sidebar/lib/searchReplace";

const LEADING_CONTEXT = 28;

function splitPreview(result: SearchResult, caseSensitive: boolean) {
  const preview = result.preview.trimStart();
  const haystack = caseSensitive ? preview : preview.toLowerCase();
  const needle = caseSensitive ? result.matchText : result.matchText.toLowerCase();
  const index = needle ? haystack.indexOf(needle) : -1;
  if (index < 0) return { before: preview, match: "", after: "" };

  const rawBefore = preview.slice(0, index);
  const before =
    rawBefore.length > LEADING_CONTEXT ? `…${rawBefore.slice(-LEADING_CONTEXT)}` : rawBefore;
  return {
    before,
    match: preview.slice(index, index + result.matchText.length),
    after: preview.slice(index + result.matchText.length),
  };
}

interface SearchResultGroupViewProps {
  group: SearchResultGroup;
  disabled: boolean;
  showReplace: boolean;
  /** What a replace writes; shown inline next to each struck-out match. */
  replacement: string;
  caseSensitive: boolean;
  onOpenResult: (result: SearchResult) => void;
  onReplaceOne: (result: SearchResult) => void;
  onReplaceAllInFile: (path: string) => void;
}

export function SearchResultGroupView({
  group,
  disabled,
  showReplace,
  replacement,
  caseSensitive,
  onOpenResult,
  onReplaceOne,
  onReplaceAllInFile,
}: SearchResultGroupViewProps) {
  const [open, setOpen] = useState(true);
  const segments = group.relativePath.split(/[/\\]/);
  const fileName = segments.pop() ?? group.relativePath;
  const directory = segments.join("/");

  return (
    <div className="flex flex-col">
      <div className="group/file flex h-7.5 items-center gap-1.5 rounded-[5px] pr-1.5 pl-1 hover:bg-bg-hover">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 flex-1 justify-start gap-1.5 px-0 text-left text-ui-xs font-normal text-fg-default hover:bg-transparent"
          title={group.relativePath}
        >
          <CaretRight
            size={10}
            weight="bold"
            className={cn("shrink-0 text-fg-subtle transition-transform", open && "rotate-90")}
          />
          <img src={getFileIconPath(fileName)} alt="" className="size-3.5 shrink-0" />
          <span className="shrink-0 font-sans text-ui-sm font-medium text-fg-default">
            {fileName}
          </span>
          {directory && (
            <span className="min-w-0 truncate font-mono text-[11px] text-fg-subtle">
              {directory}
            </span>
          )}
        </Button>
        {showReplace && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onReplaceAllInFile(group.path)}
            disabled={disabled}
            title={`Replace all matches in ${fileName}`}
            aria-label={`Replace all matches in ${fileName}`}
            className="hidden text-fg-subtle group-hover/file:inline-flex"
          >
            <ArrowsLeftRight size={12} />
          </Button>
        )}
        <span className="shrink-0 rounded-[3px] px-1.5 font-mono text-[10.5px] text-fg-muted tabular-nums ring-1 ring-fg-default/15 ring-inset">
          {group.matches.length}
        </span>
      </div>

      {open &&
        group.matches.map((match, index) => {
          const { before, match: hit, after } = splitPreview(match, caseSensitive);
          return (
            <div
              key={`${match.line}:${match.column}:${index}`}
              className="group/match flex h-6.5 items-center gap-1 rounded-[5px] pr-1 pl-3.5 hover:bg-bg-hover"
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onOpenResult(match)}
                className="min-w-0 flex-1 justify-start gap-2.5 px-0 text-left text-[11.5px] font-normal hover:bg-transparent"
                title={`Line ${match.line}`}
              >
                <span className="w-7 shrink-0 text-right text-[10.5px] text-fg-subtle tabular-nums">
                  {match.line}
                </span>
                <span className="min-w-0 truncate text-fg-muted">
                  {before}
                  {hit &&
                    (showReplace ? (
                      <>
                        <del className="rounded-[2px] bg-status-error/15 px-px text-status-error">
                          {hit}
                        </del>
                        <ins className="rounded-[2px] bg-status-success/15 px-px text-status-success no-underline">
                          {replacement}
                        </ins>
                      </>
                    ) : (
                      <mark className="rounded-[2px] bg-primary/20 px-px text-fg-default">
                        {hit}
                      </mark>
                    ))}
                  {after}
                </span>
              </Button>
              {showReplace && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onReplaceOne(match)}
                  disabled={disabled}
                  title={`Replace this match in ${fileName}`}
                  aria-label={`Replace this match in ${fileName}`}
                  className="hidden text-fg-subtle group-hover/match:inline-flex"
                >
                  <ArrowsLeftRight size={12} />
                </Button>
              )}
            </div>
          );
        })}
    </div>
  );
}
