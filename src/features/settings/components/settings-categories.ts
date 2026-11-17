import type { Icon } from "@phosphor-icons/react";
import {
  Code,
  GearSix,
  GitBranch,
  Keyboard,
  Palette,
  PuzzlePiece,
  Robot,
  Stack,
  Terminal,
} from "@phosphor-icons/react";

export type Category =
  | "general"
  | "agents"
  | "appearance"
  | "editor"
  | "terminal"
  | "git"
  | "spaces"
  | "keys"
  | "extensions";

interface CategoryDef {
  id: Category;
  label: string;
  /** The short name on the sheet's tab row. */
  tab: string;
  /** Pages with tables get a wider sheet. */
  wide?: boolean;
  icon: Icon;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "general",
    tab: "general",
    label: "General",
    icon: GearSix,
    description: "Version, updates and open source licenses.",
  },
  {
    id: "agents",
    tab: "agents",
    label: "Agents",
    icon: Robot,
    description: "Which coding CLIs Pragma starts, what they may do and how they reach you.",
  },
  {
    id: "appearance",
    tab: "look",
    label: "Appearance",
    icon: Palette,
    description: "Theme, fonts, density and motion.",
  },
  {
    id: "editor",
    tab: "editor",
    label: "Editor",
    icon: Code,
    description: "Typing, display, language servers and the models behind AI in the editor.",
  },
  {
    id: "terminal",
    tab: "terminal",
    label: "Terminal",
    icon: Terminal,
    description: "Shell, font, scrollback and suggestions of the integrated terminal.",
  },
  {
    id: "git",
    tab: "git",
    label: "Git and worktrees",
    icon: GitBranch,
    description: "What happens to the worktrees agents work in.",
  },
  {
    id: "spaces",
    tab: "spaces",
    label: "Spaces and layouts",
    icon: Stack,
    description:
      "The pane layout, terminal variables and the values this space shares in .pragma/settings.json.",
  },
  {
    id: "keys",
    tab: "keys",
    wide: true,
    label: "Keys",
    icon: Keyboard,
    description: "Every shortcut in one place. Click a binding to change it.",
  },
  {
    id: "extensions",
    tab: "tools",
    wide: true,
    label: "Extensions and tools",
    icon: PuzzlePiece,
    description: "MCP servers, skills and Pragma extensions.",
  },
];

export function isCategory(value: string | null | undefined): value is Category {
  return CATEGORIES.some((category) => category.id === value);
}
