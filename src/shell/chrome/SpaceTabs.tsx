import { useRef, useState } from "react";
import { Code, Plus, Pulse, Robot, X } from "@phosphor-icons/react";

import { collectLeaves } from "@/features/ai/panes/layout";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { useSessionActivity } from "@/features/ai/notifications/useSessionActivity";
import { useActivityStore } from "@/features/ai/activity/store";
import { useAgentStatesStore } from "@/features/ai/state/agentStates";
import { ActionContextMenu } from "@/shared/components/ui/action-menu";
import { Button } from "@/shared/components/ui/button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE, IconButton } from "@/shared/components/ui/icon-button";
import { middleClickToClose } from "@/shared/lib/middleClick";
import { formatShortcut, getIsMac, TAB_SELECT_SHORTCUTS } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useSettingsStore } from "@/shared/stores/settings";
import { TAB_NAMES, type Space, type SpaceTab } from "@/shared/stores/spaces/model";

import { AllTabsMenu, type TabEntry } from "./AllTabsMenu";
import { useLayoutPresetsStore } from "@/features/ai/panes/layoutPresets";
import { requestCloseTabs } from "./closeSpaceTabs";
import { saveTabAsLayout } from "./saveTabAsLayout";
import { spaceTabMenu } from "./spaceTabMenu";
import { TabNumber } from "./TabNumber";
import { useTabStripScroll } from "./useTabStripScroll";

function nextAgentsTabName(space: Space): string {
  const count = space.tabs.filter((tab) => tab.kind === "agents").length;
  return `${TAB_NAMES.agents} ${count + 1}`;
}

interface TabButtonProps {
  space: Space;
  tab: SpaceTab;
  index: number;
  paneCount: number;
  waiting: boolean;
}

function TabButton({ space, tab, index, paneCount, waiting }: TabButtonProps) {
  const activateTab = useOpenRepositoriesStore((state) => state.activateTab);
  const renameTab = useOpenRepositoriesStore((state) => state.renameTab);
  const addTab = useOpenRepositoriesStore((state) => state.addTab);
  const activateTabKind = useOpenRepositoriesStore((state) => state.activateTabKind);
  const [renaming, setRenaming] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const presetCount = useLayoutPresetsStore((state) => state.presets.length);
  const shortcutId = TAB_SELECT_SHORTCUTS[index];
  const binding = useSettingsStore((state) => (shortcutId ? state.shortcuts[shortcutId] : null));
  const shortcut = binding ? formatShortcut(binding, getIsMac()) : "";
  const active = tab.id === space.activeTabId;
  const closable = space.tabs.length > 1;
  const closeTabs = (tabIds: string[]) => void requestCloseTabs(space.id, tabIds);
  const closeThisTab = () => closeTabs([tab.id]);
  const menu = () =>
    spaceTabMenu(space, tab, {
      rename: () => setRenaming(true),
      newAgentsTab: () => addTab(space.id, nextAgentsTabName(space), "agents"),
      showCode: () => activateTabKind("code"),
      showActivity: () => activateTabKind("activity"),
      close: closeTabs,
      evenOut: () => useAgentsPanesStore.getState().evenOutPanes(tab.id),
      saveLayout: () => setSavingLayout(true),
    });

  return (
    <>
      <ActionContextMenu menu={menu}>
        <div
          className={cn(
            "group relative flex h-full shrink-0 items-center transition-colors duration-(--motion-fast)",
            active ? "text-fg-default" : "text-fg-subtle hover:text-fg-default",
          )}
        >
          <Button
            variant="ghost"
            role="tab"
            aria-selected={active}
            title={shortcut ? `${tab.name} (${shortcut})` : tab.name}
            onClick={() => activateTab(space.id, tab.id)}
            {...(closable ? middleClickToClose(closeThisTab) : {})}
            className="h-full gap-1.75 rounded-none px-0 text-ui-xs font-normal text-inherit hover:bg-transparent hover:text-inherit"
          >
            {index < TAB_SELECT_SHORTCUTS.length && (
              <TabNumber number={index + 1} active={active} waiting={waiting} />
            )}
            {tab.name}
            {paneCount > 0 && (
              <span aria-hidden="true" className="text-[10.5px] text-fg-subtle">
                {paneCount}
              </span>
            )}
            {waiting && <span className="sr-only">, needs you</span>}
          </Button>
          {closable && (
            <IconButton
              icon={X}
              size="sm"
              label={`Close ${tab.name} tab`}
              onClick={closeThisTab}
              className="absolute top-1/2 left-full ml-0.5 size-5 -translate-y-1/2 rounded-[4px] text-fg-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 bottom-0 h-0.5 origin-center bg-accent transition-transform duration-(--motion-base) ease-(--motion-ease-out) motion-reduce:transition-none",
              active ? "scale-x-100" : "scale-x-0",
            )}
          />
        </div>
      </ActionContextMenu>
      <InputDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename tab"
        label="Name"
        defaultValue={tab.name}
        confirmLabel="Rename"
        onConfirm={(name) => renameTab(space.id, tab.id, name)}
      />
      <InputDialog
        open={savingLayout}
        onOpenChange={setSavingLayout}
        title="Save tab as layout"
        label="Name"
        defaultValue={`Layout ${presetCount + 1}`}
        confirmLabel="Save"
        onConfirm={(name) => saveTabAsLayout(tab.id, name)}
      />
    </>
  );
}

/// The tabs of the active space, numbered for Cmd/Ctrl+1 to 9; each keeps its own layout and sessions.
export function SpaceTabs() {
  const space = useOpenRepositoriesStore(
    (state) => state.spaces.find((candidate) => candidate.id === state.activeSpaceId) ?? null,
  );
  const addTab = useOpenRepositoriesStore((state) => state.addTab);
  const activateTabKind = useOpenRepositoriesStore((state) => state.activateTabKind);
  const trees = useAgentsPanesStore((state) => state.trees);
  const { waiting } = useSessionActivity();
  const agentStates = useAgentStatesStore((state) => state.entries);
  const needsYou = (sessionId: string) =>
    waiting.includes(sessionId) || agentStates[sessionId]?.state === "needs-you";
  const anyoneAsks = useActivityStore((state) =>
    Object.values(state.entries).some((entry) => entry.state === "waiting"),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const strip = useTabStripScroll(listRef, contentRef, space?.activeTabId ?? null);

  if (!space) return null;

  const hasCodeTab = space.tabs.some((tab) => tab.kind === "code");
  const hasActivityTab = space.tabs.some((tab) => tab.kind === "activity");
  const sessionsOf = (tab: SpaceTab) =>
    tab.kind === "agents"
      ? collectLeaves(trees[tab.id]?.root ?? null).flatMap((leaf) =>
          leaf.sessionId === null ? [] : [leaf.sessionId],
        )
      : [];
  const entries: TabEntry[] = space.tabs.map((tab) => {
    const sessions = sessionsOf(tab);
    return {
      tab,
      paneCount: sessions.length,
      waiting: tab.kind === "activity" ? anyoneAsks : sessions.some(needsYou),
    };
  });

  return (
    <nav aria-label="Tabs" className="flex h-full min-w-0 items-center">
      <div
        ref={listRef}
        onScroll={strip.onScroll}
        onWheel={strip.onWheel}
        className={cn(
          "h-full min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none]",
          strip.overflowing && "mask-r-from-[calc(100%-24px)]",
          strip.scrolled && "mask-l-from-[calc(100%-24px)]",
        )}
      >
        <div ref={contentRef} role="tablist" className="flex h-full w-max items-center gap-6 pr-6">
          {entries.map((entry, index) => (
            <TabButton key={entry.tab.id} space={space} index={index} {...entry} />
          ))}
        </div>
      </div>
      {strip.overflowing && (
        <AllTabsMenu spaceId={space.id} activeTabId={space.activeTabId} entries={entries} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New tab"
              title="New tab"
              className={cn("text-fg-subtle", !strip.overflowing && "-ml-1")}
            >
              <Plus size={ICON_SIZE.sm} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuItem onClick={() => addTab(space.id, nextAgentsTabName(space), "agents")}>
            <Robot size={ICON_SIZE.sm} />
            <span>New agents tab</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => activateTabKind("code")}>
            <Code size={ICON_SIZE.sm} />
            <span>{hasCodeTab ? "Show code tab" : "Code tab"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => activateTabKind("activity")}>
            <Pulse size={ICON_SIZE.sm} />
            <span>{hasActivityTab ? "Show activity tab" : "Activity tab"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
