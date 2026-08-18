"use client";

import { useMemo, useState } from "react";
import { PuzzlePiece } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { buildPanelSrcDoc } from "../panelHtml";
import { getPanelIcon } from "../panelIcons";
import { useExtensionsStore, type RegisteredPanel } from "../store";

function panelKey(panel: RegisteredPanel): string {
  return `${panel.extensionId}/${panel.id}`;
}

export function ExtensionSidebarPanel() {
  const panels = useExtensionsStore((s) => s.panels);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(
    () => panels.find((p) => panelKey(p) === selectedKey) ?? panels[0],
    [panels, selectedKey],
  );

  if (panels.length === 0 || !selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-ui-sm text-fg-muted">
        <PuzzlePiece size={32} className="text-fg-subtle" />
        <span>No extension panels registered.</span>
        <span className="text-ui-xs text-fg-subtle">
          Extensions can contribute panels via their manifest or the pragma.panels API.
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {panels.length > 1 && (
        <div className="flex h-tab shrink-0 items-center gap-1 overflow-x-auto px-2">
          {panels.map((panel) => {
            const PanelIcon = getPanelIcon(panel.icon);
            const isActive = panelKey(panel) === panelKey(selected);
            return (
              <button
                key={panelKey(panel)}
                type="button"
                onClick={() => setSelectedKey(panelKey(panel))}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-ui-xs transition-colors",
                  isActive
                    ? "bg-bg-hover text-fg-default"
                    : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
                )}
              >
                <PanelIcon size={14} />
                <span className="truncate">{panel.title}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <iframe
          key={panelKey(selected)}
          title={`Extension panel: ${selected.title}`}
          srcDoc={buildPanelSrcDoc(selected)}
          className="h-full w-full border-0"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
