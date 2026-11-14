import { normalizePath } from "@/features/ai/named-agents/folders";
import { getWorkspaceName } from "@/shared/lib/workspaceName";

/** A saved layout of panes inside a space. */
export interface SpaceTab {
  id: string;
  name: string;
}

/** A project: one or more folders with their own tabs. The first folder is the primary one. */
export interface Space {
  id: string;
  name: string;
  folders: string[];
  tabs: SpaceTab[];
  activeTabId: string;
}

export interface SpacesSnapshot {
  spaces: Space[];
  activeSpaceId: string | null;
}

export const FIRST_TAB_NAME = "Main";

/** The first tab of a folder has a stable id, so pane layouts stored per folder can move to it. */
export function firstTabId(folder: string): string {
  return `main:${normalizePath(folder)}`;
}

export function createSpace(folder: string, id: string = crypto.randomUUID()): Space {
  const tabId = firstTabId(folder);
  return {
    id,
    name: getWorkspaceName(folder) || folder,
    folders: [folder],
    tabs: [{ id: tabId, name: FIRST_TAB_NAME }],
    activeTabId: tabId,
  };
}

export function primaryFolder(space: Space): string {
  return space.folders[0];
}

export function findSpaceByFolder(spaces: readonly Space[], folder: string): Space | undefined {
  const key = normalizePath(folder);
  return spaces.find((space) => space.folders.some((existing) => normalizePath(existing) === key));
}

/** The active tab of the space that holds the folder; a folder without a space keeps its first tab. */
export function activeTabIdFor(spaces: readonly Space[], folder: string): string {
  return findSpaceByFolder(spaces, folder)?.activeTabId ?? firstTabId(folder);
}

export function addTab(space: Space, name: string, id: string = crypto.randomUUID()): Space {
  return { ...space, tabs: [...space.tabs, { id, name }], activeTabId: id };
}

export function activateTab(space: Space, tabId: string): Space {
  if (space.activeTabId === tabId || !space.tabs.some((tab) => tab.id === tabId)) return space;
  return { ...space, activeTabId: tabId };
}

/** Closes a tab; the last tab of a space stays. Closing the active tab activates its neighbor. */
export function closeTab(space: Space, tabId: string): Space {
  const index = space.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1 || space.tabs.length === 1) return space;
  const tabs = space.tabs.filter((tab) => tab.id !== tabId);
  const activeTabId =
    space.activeTabId === tabId ? tabs[Math.min(index, tabs.length - 1)].id : space.activeTabId;
  return { ...space, tabs, activeTabId };
}

export function renameTab(space: Space, tabId: string, name: string): Space {
  const trimmed = name.trim();
  if (!trimmed) return space;
  return {
    ...space,
    tabs: space.tabs.map((tab) => (tab.id === tabId ? { ...tab, name: trimmed } : tab)),
  };
}

/** The open repositories of earlier versions: one space per folder, the active one stays active. */
export function migrateOpenRepositories(
  paths: readonly string[],
  activePath: string | null,
): SpacesSnapshot {
  const spaces = paths.map((path) => createSpace(path));
  const active = activePath ? findSpaceByFolder(spaces, activePath) : undefined;
  return { spaces, activeSpaceId: active?.id ?? null };
}
