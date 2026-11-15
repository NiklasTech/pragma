import { Plus, X } from "@phosphor-icons/react";

import { collectLeaves } from "@/features/ai/panes/layout";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { useSessionActivity } from "@/features/ai/notifications/useSessionActivity";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { StatusDot } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { TAB_NAMES, type Space, type SpaceTab } from "@/shared/stores/spaces/model";

function nextAgentsTabName(space: Space): string {
  const count = space.tabs.filter((tab) => tab.kind === "agents").length;
  return `${TAB_NAMES.agents} ${count + 1}`;
}

function TabButton({ space, tab, waiting }: { space: Space; tab: SpaceTab; waiting: boolean }) {
  const activateTab = useOpenRepositoriesStore((state) => state.activateTab);
  const closeTab = useOpenRepositoriesStore((state) => state.closeTab);
  const removeTree = useAgentsPanesStore((state) => state.removeTree);
  const active = tab.id === space.activeTabId;
  const closable = space.tabs.length > 1;

  return (
    <div
      className={cn(
        "group flex h-7.5 items-center rounded-control text-ui-sm transition-colors",
        active
          ? "bg-bg-well text-fg-default ring-1 ring-border ring-inset"
          : "text-fg-muted hover:text-fg-default",
      )}
    >
      <Button
        variant="ghost"
        role="tab"
        aria-selected={active}
        onClick={() => activateTab(space.id, tab.id)}
        className={cn(
          "h-full gap-1.75 pl-2.75 font-normal text-inherit hover:bg-transparent hover:text-inherit",
          closable ? "pr-1" : "pr-2.75",
        )}
      >
        {waiting && <StatusDot state="needs-you" decorative className="size-1.5" />}
        {tab.name}
        {waiting && <span className="sr-only">, needs you</span>}
      </Button>
      {closable && (
        <IconButton
          icon={X}
          size="sm"
          label={`Close ${tab.name} tab`}
          onClick={() => {
            closeTab(space.id, tab.id);
            removeTree(tab.id);
          }}
          className="mr-1 size-5 rounded-[5px] text-fg-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  );
}

/// The tabs of the active space; each tab keeps its own layout and switching keeps every session running.
export function SpaceTabs() {
  const space = useOpenRepositoriesStore(
    (state) => state.spaces.find((candidate) => candidate.id === state.activeSpaceId) ?? null,
  );
  const addTab = useOpenRepositoriesStore((state) => state.addTab);
  const trees = useAgentsPanesStore((state) => state.trees);
  const { waiting } = useSessionActivity();

  if (!space) return null;

  const tabWaits = (tab: SpaceTab) =>
    tab.kind === "agents" &&
    collectLeaves(trees[tab.id]?.root ?? null).some(
      (leaf) => leaf.sessionId !== null && waiting.includes(leaf.sessionId),
    );

  return (
    <nav aria-label="Tabs" className="flex min-w-0 items-center gap-0.5">
      <div role="tablist" className="flex min-w-0 items-center gap-0.5 overflow-hidden">
        {space.tabs.map((tab) => (
          <TabButton key={tab.id} space={space} tab={tab} waiting={tabWaits(tab)} />
        ))}
      </div>
      <IconButton
        icon={Plus}
        label="New agents tab"
        size="sm"
        onClick={() => addTab(space.id, nextAgentsTabName(space), "agents")}
      />
    </nav>
  );
}
