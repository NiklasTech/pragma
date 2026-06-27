import iconTheme from "material-icon-theme/dist/material-icons.json";

const BASE_PATH = "/icons/material-icon-theme";

interface MaterialIconTheme {
  folder?: string;
  folderExpanded?: string;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
}

const theme = iconTheme as MaterialIconTheme;

export function getFolderIconPath(name: string, isOpen: boolean): string {
  const key = `-${name.toLowerCase()}`;
  const iconName =
    (isOpen ? theme.folderNamesExpanded?.[key] : undefined) ??
    theme.folderNames?.[key] ??
    (isOpen ? theme.folderExpanded : theme.folder) ??
    "folder";
  return `${BASE_PATH}/${iconName}.svg`;
}
