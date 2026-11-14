import { normalizePath } from "@/features/ai/named-agents/folders";
import { getWorkspaceName } from "@/shared/lib/workspaceName";

/** Agents tabs hold agent panes; the code tab holds the editor layout. */
export type SpaceTabKind = "agents" | "code";

/** A saved layout of panes inside a space. */
export interface SpaceTab {
  id: string;
  name: string;
  kind: SpaceTabKind;
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

export const TAB_NAMES: Record<SpaceTabKind, string> = { agents: "Agents", code: "Code" };

/** The first tab of a folder has a stable id, so pane layouts stored per folder can move to it. */
export function firstTabId(folder: string): string {
  return `main:${normalizePath(folder)}`;
}

export function codeTabId(folder: string): string {
  return `code:${normalizePath(folder)}`;
}

export function primaryFolder(space: Space): string {
  return space.folders[0];
}

/** A new space opens with an agents tab and a code tab. */
export function createSpace(
  folder: string,
  id: string = crypto.randomUUID(),
  activeKind: SpaceTabKind = "agents",
): Space {
  const tabs: SpaceTab[] = [
    { id: firstTabId(folder), name: TAB_NAMES.agents, kind: "agents" },
    { id: codeTabId(folder), name: TAB_NAMES.code, kind: "code" },
  ];
  return {
    id,
    name: getWorkspaceName(folder) || folder,
    folders: [folder],
    tabs,
    activeTabId: tabs.find((tab) => tab.kind === activeKind)?.id ?? tabs[0].id,
  };
}

export function findSpaceByFolder(spaces: readonly Space[], folder: string): Space | undefined {
  const key = normalizePath(folder);
  return spaces.find((space) => space.folders.some((existing) => normalizePath(existing) === key));
}

/** The active tab of the space that holds the folder; a folder without a space keeps its first tab. */
export function activeTabIdFor(spaces: readonly Space[], folder: string): string {
  return findSpaceByFolder(spaces, folder)?.activeTabId ?? firstTabId(folder);
}

export function activeTab(space: Space): SpaceTab | undefined {
  return space.tabs.find((tab) => tab.id === space.activeTabId);
}

export function addTab(
  space: Space,
  name: string,
  kind: SpaceTabKind,
  id: string = crypto.randomUUID(),
): Space {
  return { ...space, tabs: [...space.tabs, { id, name, kind }], activeTabId: id };
}

export function activateTab(space: Space, tabId: string): Space {
  if (space.activeTabId === tabId || !space.tabs.some((tab) => tab.id === tabId)) return space;
  return { ...space, activeTabId: tabId };
}

/** Activates the first tab of the kind, adding one when the space has none. */
export function activateTabKind(space: Space, kind: SpaceTabKind): Space {
  if (activeTab(space)?.kind === kind) return space;
  const existing = space.tabs.find((tab) => tab.kind === kind);
  if (existing) return activateTab(space, existing.id);
  const id = kind === "code" ? codeTabId(primaryFolder(space)) : crypto.randomUUID();
  return addTab(space, TAB_NAMES[kind], kind, id);
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
  activeKind: SpaceTabKind = "agents",
): SpacesSnapshot {
  const spaces = paths.map((path) => createSpace(path, crypto.randomUUID(), activeKind));
  const active = activePath ? findSpaceByFolder(spaces, activePath) : undefined;
  return { spaces, activeSpaceId: active?.id ?? null };
}

interface UntypedTab {
  id: string;
  name: string;
  kind?: SpaceTabKind;
}

/** Version 1 tabs had no kind and spaces no code tab; the mode used before picks the active tab. */
export function addTabKinds(snapshot: SpacesSnapshot, activeKind: SpaceTabKind): SpacesSnapshot {
  const spaces = snapshot.spaces.map((space) => {
    const folder = primaryFolder(space);
    const typed: SpaceTab[] = (space.tabs as UntypedTab[]).map((tab) => ({
      ...tab,
      name: tab.id === firstTabId(folder) && tab.name === "Main" ? TAB_NAMES.agents : tab.name,
      kind: tab.kind ?? "agents",
    }));
    const tabs: SpaceTab[] = typed.some((tab) => tab.kind === "code")
      ? typed
      : [...typed, { id: codeTabId(folder), name: TAB_NAMES.code, kind: "code" }];
    const migrated = { ...space, tabs };
    return activeKind === "code" ? activateTabKind(migrated, "code") : migrated;
  });
  return { ...snapshot, spaces };
}
