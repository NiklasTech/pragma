import {
  AUTO_CONTEXT_PREFIX,
  capAutoContextSections,
  type AutoContextSection,
  type CappedAutoContext,
} from "@/shared/lib/chat-context";

export interface ChatContextSources {
  activeFile: boolean;
  openTabs: boolean;
  gitDiff: boolean;
  terminal: boolean;
}

// Nothing is attached automatically; every source is opt-in through Settings -> Chat Context or an @-mention.
export const DEFAULT_CHAT_CONTEXT_SOURCES: ChatContextSources = {
  activeFile: false,
  openTabs: false,
  gitDiff: false,
  terminal: false,
};

const ACTIVE_FILE_CHAR_CAP = 6000;
const TAB_EXCERPT_CHAR_CAP = 240;
const MAX_TAB_EXCERPTS = 5;
const GIT_DIFF_CHAR_CAP = 12000;
const TERMINAL_CHAR_CAP = 4000;

export interface ActiveFileContext {
  path: string;
  content: string;
  selection: string | null;
}

export interface OpenTabContext {
  path: string;
  name: string;
  content: string;
}

export interface AutoContextInput {
  rootPath: string | null;
  activeFile: ActiveFileContext | null;
  openTabs: readonly OpenTabContext[];
  gitDiff: string | null;
  terminalOutput: string | null;
  sources: ChatContextSources;
  maxTokens?: number;
}

export function relativePath(rootPath: string | null, path: string): string {
  if (!rootPath) return path;
  const normalizedRoot = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedPath = path.replace(/\\/g, "/");
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}

function excerpt(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n[content truncated]`;
}

function activeFileSection(input: AutoContextInput): AutoContextSection | null {
  const active = input.activeFile;
  if (!active) return null;

  const label = `Active file: ${relativePath(input.rootPath, active.path)}`;
  const parts: string[] = [];
  const selection = active.selection?.trim();

  if (selection) {
    parts.push(`Selected code:\n\`\`\`\n${selection}\n\`\`\``);
  }

  const content = active.content.trim();
  if (content && content !== selection) {
    parts.push(`File content:\n${excerpt(content, ACTIVE_FILE_CHAR_CAP)}`);
  }

  if (parts.length === 0) return null;
  return { id: "active-file", label, content: parts.join("\n\n") };
}

function openTabsSection(input: AutoContextInput): AutoContextSection | null {
  const activePath = input.activeFile?.path;
  const others = input.openTabs.filter((tab) => tab.path !== activePath);
  if (others.length === 0) return null;

  const lines: string[] = [];
  for (const [index, tab] of others.entries()) {
    lines.push(relativePath(input.rootPath, tab.path));
    const content = tab.content.trim();
    if (index < MAX_TAB_EXCERPTS && content) {
      lines.push(`  ${excerpt(content, TAB_EXCERPT_CHAR_CAP).replace(/\n/g, "\n  ")}`);
    }
  }

  return { id: "open-tabs", label: "Other open tabs", content: lines.join("\n") };
}

function gitDiffSection(input: AutoContextInput): AutoContextSection | null {
  const diff = input.gitDiff?.trim();
  if (!diff) return null;
  return {
    id: "git-diff",
    label: "Workspace diff (unstaged + staged)",
    content: excerpt(diff, GIT_DIFF_CHAR_CAP),
  };
}

function terminalSection(input: AutoContextInput): AutoContextSection | null {
  const output = input.terminalOutput?.trim();
  if (!output) return null;
  return {
    id: "terminal",
    label: "Recent terminal output",
    content: excerpt(output, TERMINAL_CHAR_CAP),
  };
}

export function assembleAutoContext(input: AutoContextInput): CappedAutoContext {
  const sections: AutoContextSection[] = [];

  if (input.sources.activeFile) {
    const section = activeFileSection(input);
    if (section) sections.push(section);
  }
  if (input.sources.openTabs) {
    const section = openTabsSection(input);
    if (section) sections.push(section);
  }
  if (input.sources.gitDiff) {
    const section = gitDiffSection(input);
    if (section) sections.push(section);
  }
  if (input.sources.terminal) {
    const section = terminalSection(input);
    if (section) sections.push(section);
  }

  return capAutoContextSections(sections, input.maxTokens);
}

export function buildAutoContextPrompt(capped: CappedAutoContext): string {
  if (!capped.text.trim()) return "";
  return `${AUTO_CONTEXT_PREFIX}\n\n${capped.text}`;
}
