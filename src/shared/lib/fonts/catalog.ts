import type { FontCatalogEntry } from "./types";

export const FONT_CATALOG: FontCatalogEntry[] = [
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    license: "OFL 1.1",
    url: "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip",
    files: [
      { weight: 400, style: "normal", filename: "JetBrainsMono-Regular.ttf" },
      { weight: 700, style: "normal", filename: "JetBrainsMono-Bold.ttf" },
      { weight: 400, style: "italic", filename: "JetBrainsMono-Italic.ttf" },
    ],
  },
  {
    id: "fira-code",
    name: "Fira Code",
    license: "OFL 1.1",
    url: "https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip",
    files: [
      { weight: 400, style: "normal", filename: "FiraCode-Regular.ttf" },
      { weight: 700, style: "normal", filename: "FiraCode-Bold.ttf" },
      { weight: 400, style: "italic", filename: "FiraCode-Retina.ttf" },
    ],
  },
  {
    id: "hack",
    name: "Hack",
    license: "Bitstream Vera & MIT",
    url: "https://github.com/source-foundry/Hack/releases/download/v3.003/Hack-v3.003-ttf.zip",
    files: [
      { weight: 400, style: "normal", filename: "Hack-Regular.ttf" },
      { weight: 700, style: "normal", filename: "Hack-Bold.ttf" },
      { weight: 400, style: "italic", filename: "Hack-Italic.ttf" },
    ],
  },
  {
    id: "cascadia-code",
    name: "Cascadia Code",
    license: "OFL 1.1",
    url: "https://github.com/microsoft/cascadia-code/releases/download/v2407.24/CascadiaCode-2407.24.zip",
    files: [
      { weight: 400, style: "normal", filename: "CascadiaCode.ttf" },
      { weight: 700, style: "normal", filename: "CascadiaCode-Bold.ttf" },
      { weight: 400, style: "italic", filename: "CascadiaCode-Italic.ttf" },
    ],
  },
];
