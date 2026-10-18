import { folder, folderExpanded, folderNames } from "material-icon-theme/dist/material-icons.json";

const BASE_PATH = "/icons/material-icon-theme";

interface MaterialIconTheme {
  folder?: string;
  folderExpanded?: string;
  folderNames?: Record<string, string>;
}

const theme: MaterialIconTheme = { folder, folderExpanded, folderNames };

export function getFolderIconPath(name: string, isOpen: boolean): string {
  const key = `-${name.toLowerCase()}`;
  const named = theme.folderNames?.[key];
  // The manifest's `folderNamesExpanded` is always `folderNames` plus `-open` (see the test), so it is not bundled.
  const iconName =
    (named && (isOpen ? `${named}-open` : named)) ??
    (isOpen ? theme.folderExpanded : theme.folder) ??
    "folder";
  return `${BASE_PATH}/${iconName}.svg`;
}
