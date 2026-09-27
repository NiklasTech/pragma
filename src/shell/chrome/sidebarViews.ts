import type { Icon } from "@phosphor-icons/react";
import {
  Bug,
  Cube,
  Files,
  GitBranch,
  GitDiff,
  MagnifyingGlass,
  PuzzlePiece,
  Terminal,
} from "@phosphor-icons/react";

import type { SidebarTab } from "@/shell/layout/tree/types";

export interface SidebarView {
  id: SidebarTab;
  label: string;
  icon: Icon;
}

export const primarySidebarViews: SidebarView[] = [
  { id: "explorer", label: "Files", icon: Files },
  { id: "search", label: "Search", icon: MagnifyingGlass },
  { id: "git-status", label: "Changes", icon: GitDiff },
  { id: "git", label: "History", icon: GitBranch },
];

export const secondarySidebarViews: SidebarView[] = [
  { id: "debug", label: "Debug", icon: Bug },
  { id: "docker", label: "Docker", icon: Cube },
  { id: "processes", label: "Processes", icon: Terminal },
  { id: "extensions", label: "Extensions", icon: PuzzlePiece },
];
