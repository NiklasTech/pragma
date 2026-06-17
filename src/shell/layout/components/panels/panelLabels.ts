import type { PanelKind } from "../../tree/types";

export const panelLabel = (kind: PanelKind): string => {
  switch (kind) {
    case "welcome":
      return "Welcome";
    case "editor":
      return "Editor";
    case "terminal":
      return "Terminal";
    case "run-output":
      return "Run Output";
    case "output":
      return "Output";
    case "git-diff":
      return "Git Diff";
    case "git-history":
      return "Git History";
    case "ai-diff":
      return "AI Diff";
    case "problems":
      return "Problems";
    case "preview":
      return "Preview";
    case "markdown":
      return "Markdown";
    case "settings":
      return "Settings";
    default:
      return kind;
  }
};
