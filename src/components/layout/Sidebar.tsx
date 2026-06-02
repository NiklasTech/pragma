import type { PanelImperativeHandle } from "react-resizable-panels";
import { useLayoutStore } from "@/stores/layout";
import { cn } from "@/lib/utils";
import {
  Files,
  GitBranch,
  MagnifyingGlass,
  Sidebar as SidebarIcon,
  SidebarSimple,
} from "@phosphor-icons/react";

const tabs = [
  { id: "explorer" as const, icon: Files, label: "Explorer" },
  { id: "search" as const, icon: MagnifyingGlass, label: "Search" },
  { id: "git" as const, icon: GitBranch, label: "Source Control" },
];

export function SidebarContent({
  panelRef,
}: {
  panelRef: React.RefObject<PanelImperativeHandle | null>;
}) {
  const { sidebarTab, setSidebarTab, sidebarWidth } = useLayoutStore();

  const isCollapsed = sidebarWidth <= 10;

  const handleToggle = () => {
    panelRef.current?.resize(isCollapsed ? 20 : 8);
  };

  return (
    <div className="flex h-full bg-card border-r border-border">
      <div className="flex flex-col items-center py-2 w-12 shrink-0 border-r border-border">
        <button
          onClick={handleToggle}
          className="mb-4 p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <SidebarSimple size={20} /> : <SidebarIcon size={20} />}
        </button>
        <div className="flex flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSidebarTab(tab.id);
                if (isCollapsed) panelRef.current?.resize(20);
              }}
              className={cn(
                "p-2 rounded-md transition-colors",
                sidebarTab === tab.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title={tab.label}
            >
              <tab.icon size={20} />
            </button>
          ))}
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-1 p-4 min-w-0 overflow-hidden">
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">
            {tabs.find((t) => t.id === sidebarTab)?.label}
          </h2>
          <p className="text-sm text-muted-foreground">{sidebarTab} content</p>
        </div>
      )}
    </div>
  );
}
