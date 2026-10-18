import { describe, expect, it } from "vite-plus/test";
import iconTheme from "material-icon-theme/dist/material-icons.json";

import { getFolderIconPath } from "./folder-icons";

const BASE_PATH = "/icons/material-icon-theme";

function manifestFolderIconPath(name: string, isOpen: boolean): string {
  const expanded: Record<string, string> = iconTheme.folderNamesExpanded;
  const names: Record<string, string> = iconTheme.folderNames;
  const key = `-${name.toLowerCase()}`;
  const iconName =
    (isOpen ? expanded[key] : undefined) ??
    names[key] ??
    (isOpen ? iconTheme.folderExpanded : iconTheme.folder);
  return `${BASE_PATH}/${iconName}.svg`;
}

describe("getFolderIconPath", () => {
  it("matches the full manifest for every named folder", () => {
    const names = Object.keys(iconTheme.folderNamesExpanded).map((key) => key.replace(/^-/, ""));
    for (const name of names) {
      expect(getFolderIconPath(name, true)).toBe(manifestFolderIconPath(name, true));
      expect(getFolderIconPath(name, false)).toBe(manifestFolderIconPath(name, false));
    }
  });

  it("falls back to the generic folder icons", () => {
    expect(getFolderIconPath("no-such-folder-name", false)).toBe(`${BASE_PATH}/folder.svg`);
    expect(getFolderIconPath("no-such-folder-name", true)).toBe(`${BASE_PATH}/folder-open.svg`);
  });
});
