export type ThemeMode = "dark" | "light" | "system";

export type SupportedMode = "dark" | "light";

export interface ThemeMetadata {
  id: string;
  name: string;
  author?: string;
  description?: string;
  version?: string;
  license?: string;
  homepage?: string;
}

export interface ThemeAppearance {
  defaultMode: ThemeMode;
  supportedModes: SupportedMode[];
}

export interface BackgroundTokens {
  chrome?: string;
  root: string;
  surface: string;
  elevated: string;
  input: string;
  hover: string;
  active: string;
  overlay: string;
}

export interface ForegroundTokens {
  default: string;
  muted: string;
  subtle: string;
  inverse: string;
}

export interface AccentTokens {
  default: string;
  subtle: string;
  glow: string;
}

export interface BorderTokens {
  default: string;
  subtle: string;
  focus: string;
}

export interface StatusTokens {
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;
}

export interface GitTokens {
  added: string;
  addedBg: string;
  modified: string;
  modifiedBg: string;
  deleted: string;
  deletedBg: string;
  untracked: string;
  untrackedBg: string;
  ignored: string;
  conflict: string;
}

export interface ThreadTokens {
  default: string;
  active: string;
}

export interface ScrollbarTokens {
  track: string;
  thumb: string;
  thumbHover: string;
}

export interface ColorTokens {
  background: BackgroundTokens;
  foreground: ForegroundTokens;
  accent: AccentTokens;
  border: BorderTokens;
  status: StatusTokens;
  git: GitTokens;
  thread: ThreadTokens;
  selection: string;
  scrollbar: ScrollbarTokens;
}

export interface EditorGutterTokens {
  background: string;
  foreground: string;
  activeBackground: string;
}

export interface EditorLineTokens {
  active: string;
  highlight: string;
}

export interface SyntaxTokens {
  keyword: string;
  string: string;
  comment: string;
  function: string;
  variable: string;
  number: string;
  type: string;
  tag: string;
  attribute: string;
  property: string;
  operator: string;
}

export interface EditorTokens {
  background: string;
  foreground: string;
  selection: string;
  cursor: string;
  gutter: EditorGutterTokens;
  line: EditorLineTokens;
  syntax: SyntaxTokens;
}

export interface TerminalAnsiTokens {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
}

export interface TerminalTokens {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  ansi: TerminalAnsiTokens;
  ansiBright: TerminalAnsiTokens;
}

export interface ShadowTokens {
  sm: string;
  md: string;
}

export interface ThemeTokens {
  colors: ColorTokens;
  editor: EditorTokens;
  terminal: TerminalTokens;
  shadows?: ShadowTokens;
}

export interface Theme {
  $schema?: string;
  format: "pragma-theme-v1";
  metadata: ThemeMetadata;
  appearance: ThemeAppearance;
  tokens: ThemeTokens;
}

export type ThemeInput = Omit<Theme, "format"> & { format?: string };

export interface ResolvedTheme extends Theme {
  tokens: ThemeTokens;
}

/** Base colors a theme file can give instead of every token. */
export interface ThemePalette {
  background: string;
  foreground: string;
  accent: string;
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** A theme as written on disk: a full theme, an `extends` override or a `palette`. */
export interface ThemeFile {
  $schema?: string;
  format?: string;
  metadata: ThemeMetadata;
  appearance?: ThemeAppearance;
  extends?: string;
  palette?: ThemePalette;
  tokens?: DeepPartial<ThemeTokens>;
}
