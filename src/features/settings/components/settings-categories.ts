import type { Icon } from "@phosphor-icons/react";
import {
  Code,
  Terminal,
  Robot,
  Palette,
  PlugsConnected,
  Layout,
  Keyboard,
  Info,
  BracketsAngle,
  PuzzlePiece,
  Microphone,
  FolderSimple,
} from "@phosphor-icons/react";

export type Category =
  | "editor"
  | "terminal"
  | "agents"
  | "voice"
  | "theme"
  | "mcp"
  | "layout"
  | "keyboard"
  | "project"
  | "languages"
  | "extensions"
  | "about";

interface CategoryDef {
  id: Category;
  label: string;
  icon: Icon;
  group: string;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "editor",
    label: "Editor",
    icon: Code,
    group: "Workspace",
    description: "Typing, formatting and how code is displayed.",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: Terminal,
    group: "Workspace",
    description: "Shell, fonts and suggestions in the integrated terminal.",
  },
  {
    id: "layout",
    label: "Layout",
    icon: Layout,
    group: "Workspace",
    description: "Sidebar, panels and what the status bar shows.",
  },
  {
    id: "keyboard",
    label: "Keyboard",
    icon: Keyboard,
    group: "Workspace",
    description: "Every shortcut in one place. Click a binding to change it.",
  },
  {
    id: "project",
    label: "Project",
    icon: FolderSimple,
    group: "Workspace",
    description:
      "Overrides for this folder, saved in .pragma/settings.json and shared with the repo.",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Robot,
    group: "Intelligence",
    description: "AI providers, models and how agents ask before they act.",
  },
  {
    id: "voice",
    label: "Voice",
    icon: Microphone,
    group: "Intelligence",
    description: "Dictate into the chat by click or by holding a shortcut.",
  },
  {
    id: "mcp",
    label: "MCP",
    icon: PlugsConnected,
    group: "Intelligence",
    description: "Connect Model Context Protocol servers as extra tools.",
  },
  {
    id: "languages",
    label: "Languages",
    icon: BracketsAngle,
    group: "Intelligence",
    description: "Language servers for completion, diagnostics and navigation.",
  },
  {
    id: "theme",
    label: "Theme",
    icon: Palette,
    group: "Appearance",
    description: "Colors, light and dark mode and your own themes.",
  },
  {
    id: "extensions",
    label: "Extensions",
    icon: PuzzlePiece,
    group: "More",
    description: "Install and manage Pragma extensions.",
  },
  {
    id: "about",
    label: "About",
    icon: Info,
    group: "More",
    description: "Version, updates and open source licenses.",
  },
];

export const CATEGORY_GROUPS = Array.from(new Set(CATEGORIES.map((category) => category.group)));
