import {
  CalendarBlank,
  ChartLine,
  GitBranch,
  Globe,
  Heart,
  Lightning,
  ListBullets,
  Note,
  PuzzlePiece,
  Star,
  Terminal,
  type Icon,
} from "@phosphor-icons/react";

export const PANEL_ICONS: Record<string, Icon> = {
  "calendar-blank": CalendarBlank,
  "chart-line": ChartLine,
  "git-branch": GitBranch,
  globe: Globe,
  heart: Heart,
  lightning: Lightning,
  "list-bullets": ListBullets,
  note: Note,
  "puzzle-piece": PuzzlePiece,
  star: Star,
  terminal: Terminal,
};

export const DEFAULT_PANEL_ICON: Icon = PuzzlePiece;

export function getPanelIcon(name: string | undefined): Icon {
  if (!name) return DEFAULT_PANEL_ICON;
  return PANEL_ICONS[name] ?? DEFAULT_PANEL_ICON;
}
