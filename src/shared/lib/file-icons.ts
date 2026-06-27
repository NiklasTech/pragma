import iconTheme from "material-icon-theme/dist/material-icons.json";

const BASE_PATH = "/icons/material-icon-theme";

interface MaterialIconTheme {
  file?: string;
  fileNames?: Record<string, string>;
  fileExtensions?: Record<string, string>;
}

const theme = iconTheme as MaterialIconTheme;

export function getFileIconPath(name: string): string {
  const lowerName = name.toLowerCase();
  const fileNameIcon = theme.fileNames?.[lowerName];
  if (fileNameIcon) {
    return `${BASE_PATH}/${fileNameIcon}.svg`;
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const extIcon = theme.fileExtensions?.[ext];
  if (extIcon) {
    return `${BASE_PATH}/${extIcon}.svg`;
  }

  const defaultIcon = theme.file ?? "file";
  return `${BASE_PATH}/${defaultIcon}.svg`;
}
