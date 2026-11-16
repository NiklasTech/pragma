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
  icon: Icon;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "general",
    label: "General",
    icon: GearSix,
    description: "Version, updates and open source licenses.",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Robot,
    description: "Which coding CLIs Pragma starts, what they may do and how they reach you.",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme, fonts, density and motion.",
  },
  {
    id: "editor",
    label: "Editor",
    icon: Code,
    description: "Typing, display, language servers and the models behind AI in the editor.",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: Terminal,
    description: "Shell, font, scrollback and suggestions of the integrated terminal.",
  },
  {
    id: "git",
    label: "Git and worktrees",
    icon: GitBranch,
    description: "What happens to the worktrees agents work in.",
  },
  {
    id: "spaces",
    label: "Spaces and layouts",
    icon: Stack,
    description:
      "The pane layout, terminal variables and the values this space shares in .pragma/settings.json.",
  },
  {
    id: "keys",
    label: "Keys",
    icon: Keyboard,
    description: "Every shortcut in one place. Click a binding to change it.",
  },
  {
    id: "extensions",
    label: "Extensions and tools",
    icon: PuzzlePiece,
    description: "MCP servers, skills and Pragma extensions.",
  },
];

export function isCategory(value: string | null | undefined): value is Category {
  return CATEGORIES.some((category) => category.id === value);
}
