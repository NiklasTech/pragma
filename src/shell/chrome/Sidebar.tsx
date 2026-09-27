import { useLayoutStore } from "@/shell/layout/store";
import type { SidebarTab } from "@/shell/layout/tree/types";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import {
  DockerPanel,
  FileExplorer,
  GitGraph,
  GitStatus,
  LocalHistoryPanel,
  ProcessManagerPanel,
  SearchPanel,
} from "@/features/sidebar/components";
import { DebugPanel } from "@/features/debug/components/DebugPanel";
import { ExtensionSidebarPanel } from "@/features/extensions/components/ExtensionSidebarPanel";

import { ViewShelf } from "./ViewShelf";

function SidebarViewContent({ tab }: { tab: SidebarTab }) {
  switch (tab) {
    case "search":
      return <SearchPanel />;
    case "git":
      return <GitGraph />;
    case "git-status":
      return <GitStatus />;
    case "docker":
      return <DockerPanel />;
    case "processes":
      return <ProcessManagerPanel />;
    case "debug":
      return <DebugPanel />;
    case "extensions":
      return <ExtensionSidebarPanel />;
    default:
      return <FileExplorer />;
  }
}

export function SidebarContent() {
  const tab = useLayoutStore((s) => s.sidebar.tab);
  const { isOpen, activeFilePath, closePanel } = useLocalHistory();

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden pt-1">
        <SidebarViewContent tab={tab} />
      </div>

      {activeFilePath && (
        <LocalHistoryPanel filePath={activeFilePath} isOpen={isOpen} onClose={closePanel} />
      )}

      <div className="flex shrink-0 justify-center px-2 pt-1 pb-2">
        <ViewShelf />
      </div>
    </div>
  );
}
