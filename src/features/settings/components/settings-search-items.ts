import { SETTINGS_SCHEMA } from "../schema";
import type { Category } from "./settings-categories";

export interface SearchItem {
  id: string;
  label: string;
  keywords: string;
  category: Category;
  /** The text on the settings page to jump to, when it differs from `label`. */
  target?: string;
}

/** Sections and actions that are not a single stored setting. */
const PAGE_ITEMS: SearchItem[] = [
  {
    id: "agent-notifications",
    label: "Notifications",
    keywords: "notifications notify badge dock taskbar session finished failed approval status",
    category: "agents",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    keywords: "accessibility reduce motion animation focus outline color blind high contrast",
    category: "appearance",
  },
  {
    id: "layout-reset",
    label: "Reset Panel Sizes",
    keywords: "layout reset panels size",
    category: "layout",
    target: "Reset Layout",
  },
  {
    id: "about-version",
    label: "Version",
    keywords: "about version update release pragma",
    category: "about",
    target: "Application",
  },
  {
    id: "about-license",
    label: "License",
    keywords: "about license legal copyright apache",
    category: "about",
    target: "Legal",
  },
];

export const SEARCH_ITEMS: SearchItem[] = [
  ...SETTINGS_SCHEMA.map((setting) => ({
    id: setting.id,
    label: setting.searchLabel ?? setting.label,
    keywords: setting.keywords,
    category: setting.category,
    target: setting.label,
  })),
  ...PAGE_ITEMS,
];
