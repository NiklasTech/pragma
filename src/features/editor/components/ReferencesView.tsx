import { useMemo } from "react";
import { FileText, Info } from "@phosphor-icons/react";

import { useEditorStore, type ReferenceLocation, type ReferencesTab } from "@/shared/stores/editor";
import { navigateToLocation } from "@/features/editor/lsp/definition";

export function ReferencesView({ tab }: { tab: ReferencesTab }) {
  const grouped = useMemo(() => {
    const byFile = new Map<string, ReferenceLocation[]>();
    for (const location of tab.locations) {
      const list = byFile.get(location.filePath) ?? [];
      list.push(location);
      byFile.set(location.filePath, list);
    }
    return [...byFile.entries()];
  }, [tab.locations]);

  const handleClick = (location: ReferenceLocation) => {
    void navigateToLocation({
      filePath: location.filePath,
      line: location.range.start.line,
      character: location.range.start.character,
    });
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 items-center px-3">
        <span className="text-ui-xs font-medium text-fg-default">
          References
          <span className="ml-2 rounded-full bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-muted">
            {tab.locations.length}
          </span>
        </span>
        <span className="ml-2 truncate text-ui-xs text-fg-muted">{tab.symbol}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab.locations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
            <Info size={28} className="text-fg-subtle" />
            <span>No references found.</span>
          </div>
        ) : (
          grouped.map(([filePath, locations]) => (
            <div key={filePath}>
              <div className="flex items-center gap-1.5 border-b border-border-subtle bg-bg-surface px-3 py-1.5 text-ui-xs text-fg-muted">
                <FileText size={12} />
                <span className="truncate">{filePath}</span>
                <span className="rounded bg-bg-hover px-1 text-ui-2xs text-fg-subtle">
                  {locations.length}
                </span>
              </div>
              <ul className="divide-y divide-border-subtle">
                {locations.map((location, index) => (
                  <li
                    key={`${location.range.start.line}:${location.range.start.character}:${index}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleClick(location)}
                      className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-bg-hover"
                    >
                      <span className="w-16 shrink-0 text-ui-2xs text-fg-subtle">
                        {location.range.start.line + 1}:{location.range.start.character + 1}
                      </span>
                      <LocationLine location={location} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LocationLine({ location }: { location: ReferenceLocation }) {
  const lineText = useEditorStore((state) => {
    const file = state.tabs.find((t) => t.kind === "file" && t.path === location.filePath);
    if (!file || file.kind !== "file") {
      return "";
    }
    return file.content.split("\n")[location.range.start.line]?.trim() ?? "";
  });

  return <span className="truncate font-mono text-ui-xs text-fg-default">{lineText}</span>;
}
