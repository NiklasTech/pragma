import { useLayoutStore } from "@/shell/layout/store";
import type { SidebarTab } from "@/shell/layout/tree/types";
import { useLocalHistory } from "@/shared/hooks/useLocalHistory";
import { Suspense, lazy } from "react";
import { FileExplorer } from "@/features/sidebar/components/FileExplorer";
import { ViewShelf } from "./ViewShelf";

const DockerPanel = lazy(() =>
  import("@/features/sidebar/components/DockerPanel").then((m) => ({ default: m.DockerPanel })),
);
const GitGraph = lazy(() =>
  import("@/features/sidebar/components/GitGraph").then((m) => ({ default: m.GitGraph })),
);
const GitStatus = lazy(() =>
  import("@/features/sidebar/components/GitStatus").then((m) => ({ default: m.GitStatus })),
);
const LocalHistoryPanel = lazy(() =>
  import("@/features/sidebar/components/LocalHistoryPanel").then((m) => ({
    default: m.LocalHistoryPanel,
  })),
);
const ProcessManagerPanel = lazy(() =>
  import("@/features/sidebar/components/ProcessManagerPanel").then((m) => ({
    default: m.ProcessManagerPanel,
  })),
);
const SearchPanel = lazy(() =>
  import("@/features/sidebar/components/SearchPanel").then((m) => ({ default: m.SearchPanel })),
);
const DebugPanel = lazy(() =>
  import("@/features/debug/components/DebugPanel").then((m) => ({ default: m.DebugPanel })),
);
const ExtensionSidebarPanel = lazy(() =>
  import("@/features/extensions/components/ExtensionSidebarPanel").then((m) => ({
    default: m.ExtensionSidebarPanel,
  })),
);

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
        <Suspense fallback={null}>
          <SidebarViewContent tab={tab} />
        </Suspense>
      </div>

      {activeFilePath && (
        <Suspense fallback={null}>
          <LocalHistoryPanel filePath={activeFilePath} isOpen={isOpen} onClose={closePanel} />
        </Suspense>
      )}

      <div className="flex shrink-0 justify-center px-2 pt-1 pb-2">
        <ViewShelf />
      </div>
    </div>
  );
}
