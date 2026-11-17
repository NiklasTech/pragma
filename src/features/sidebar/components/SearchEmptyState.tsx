import { ClockCounterClockwise } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";

interface IdleProps {
  recent: string[];
  onPick: (query: string) => void;
  /** The binding of Find in Files, for example "⌘⇧F". */
  findShortcut: string;
  /** The binding of Go to, for example "⌘P". */
  goToShortcut: string;
}

function KeyRow({ keys, children }: { keys: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1 text-ui-xs text-fg-muted">
      <Kbd className="w-9 justify-center">{keys}</Kbd>
      {children}
    </li>
  );
}

/// Before the first query: the last searches to pick up again and the keys of this panel.
export function SearchIdle({ recent, onPick, findShortcut, goToShortcut }: IdleProps) {
  return (
    <div className="flex flex-col gap-5 px-3 py-3">
      {recent.length > 0 && (
        <section className="flex flex-col gap-1">
          <span className="px-1 font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle uppercase">
            recent
          </span>
          {recent.map((query) => (
            <Button
              key={query}
              variant="ghost"
              size="xs"
              onClick={() => onPick(query)}
              className="h-7 justify-start gap-2 px-1.5 text-ui-xs text-fg-default"
            >
              <ClockCounterClockwise size={12} className="text-fg-subtle" />
              <span className="truncate">{query}</span>
            </Button>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-1">
        <span className="px-1 font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle uppercase">
          keys
        </span>
        <ul className="flex flex-col px-1">
          <KeyRow keys={findShortcut}>search from anywhere</KeyRow>
          <KeyRow keys="Aa">match upper and lower case</KeyRow>
          <KeyRow keys="\b">only whole words</KeyRow>
          <KeyRow keys=".*">regular expression</KeyRow>
          <KeyRow keys={goToShortcut}>jump to a file by name instead</KeyRow>
        </ul>
      </section>
    </div>
  );
}

interface NoMatchesProps {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  hasFilters: boolean;
  onIgnoreCase: () => void;
  onAnyPart: () => void;
  onPlainText: () => void;
  onClearFilters: () => void;
}

/// No match: says what was searched and offers the options that would widen it.
export function SearchNoMatches(props: NoMatchesProps) {
  const ways = [
    props.caseSensitive && { label: "ignore case", run: props.onIgnoreCase },
    props.wholeWord && { label: "match parts of words", run: props.onAnyPart },
    props.useRegex && { label: "search as plain text", run: props.onPlainText },
    props.hasFilters && { label: "clear filters", run: props.onClearFilters },
  ].filter((way): way is { label: string; run: () => void } => Boolean(way));

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <p className="text-ui-xs text-fg-muted">
        No match for{" "}
        <span className="rounded-[3px] bg-bg-hover px-1 font-mono text-fg-default">
          {props.query}
        </span>
        {ways.length === 0 ? " in this space." : "."}
      </p>
      {ways.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ways.map((way) => (
            <Button key={way.label} variant="outline" size="xs" onClick={way.run}>
              {way.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
