import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BookOpenText,
  Code,
  GitDiff,
  Globe,
  TerminalWindow,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";

import { selectProblems } from "@/shared/lib/problemsReport";
import { useGitStore } from "@/shared/stores/git";
import type { GitCommit } from "@/shared/stores/git/types";
import { useProblemsStore, type Problem } from "@/shared/stores/problems";
import { useTerminalStore, type TerminalSession } from "@/shared/stores/terminal";
import { relativePath } from "@/features/ai/context/autoContext";
import { useSkillsStore } from "@/features/ai/skills/store";
import type { Skill } from "@/features/ai/skills/types";
import { lspWorkspaceSymbol, type LspWorkspaceSymbolItem } from "@/features/editor/lsp/client";
import { symbolKindName } from "@/features/editor/lsp/symbols";
import { hasTerminalOutput } from "@/features/terminal/terminalOutput";

import {
  CONTEXT_MENTION_KINDS,
  formatContextMention,
  isHttpUrl,
  splitMentionQuery,
  type ContextMentionKind,
} from "./contextMentions";
import { symbolSearchContext } from "./symbolMention";

export interface MentionPickerItem {
  key: string;
  token: string;
  label: string;
  detail?: string;
  icon: Icon;
  /** Inserts the token without a trailing space so the picker stays open for the next step. */
  keepOpen?: boolean;
}

export interface MentionPickerSection {
  title: string;
  items: MentionPickerItem[];
  hint: string | null;
  /** A kind was chosen, so files and MCP resources are hidden. */
  scoped: boolean;
}

interface MentionSources {
  rootPath: string | null;
  symbols: LspWorkspaceSymbolItem[];
  hasSymbolServer: boolean;
  problems: Problem[];
  commits: GitCommit[];
  terminals: TerminalSession[];
  skills: Skill[];
}

const KIND_ICONS: Record<ContextMentionKind, Icon> = {
  symbol: Code,
  problems: WarningCircle,
  diff: GitDiff,
  terminal: TerminalWindow,
  url: Globe,
  skill: BookOpenText,
};

const KIND_TITLES: Record<ContextMentionKind, string> = {
  symbol: "Symbols",
  problems: "Problems",
  diff: "Diffs",
  terminal: "Terminals",
  url: "Web page",
  skill: "Skills",
};

const SYMBOL_SEARCH_DELAY_MS = 150;
const MAX_SYMBOLS = 50;
const COMMIT_LIMIT = 20;
const COMMIT_SHA_LENGTH = 12;
const TERMINAL_ID_LENGTH = 8;

function matches(query: string, ...texts: string[]): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || texts.some((text) => text.toLowerCase().includes(needle));
}

function item(
  kind: ContextMentionKind,
  token: string,
  label: string,
  detail?: string,
): MentionPickerItem {
  return { key: token, token, label, detail, icon: KIND_ICONS[kind] };
}

function symbolItems(sources: MentionSources): MentionPickerItem[] {
  return sources.symbols.slice(0, MAX_SYMBOLS).map((symbol) => {
    const path = relativePath(sources.rootPath, symbol.location.filePath);
    const line = symbol.location.range.start.line + 1;
    const token = formatContextMention({ kind: "symbol", name: symbol.name, path, line });
    const container = symbol.containerName ? ` in ${symbol.containerName}` : "";
    return item(
      "symbol",
      token,
      symbol.name,
      `${symbolKindName(symbol.kind)}${container} · ${path}:${line}`,
    );
  });
}

function problemItems(rest: string, sources: MentionSources): MentionPickerItem[] {
  const problems = selectProblems(sources.problems, ["error", "warning"]);
  if (problems.length === 0) return [];
  const counts = new Map<string, number>();
  for (const problem of problems) {
    counts.set(problem.filePath, (counts.get(problem.filePath) ?? 0) + 1);
  }
  const errors = problems.filter((problem) => problem.severity === "error").length;
  const all = item(
    "problems",
    formatContextMention({ kind: "problems", path: null }),
    "All problems",
    `${errors} errors, ${problems.length - errors} warnings`,
  );
  const files = [...counts].map(([filePath, count]) => {
    const path = relativePath(sources.rootPath, filePath);
    return item("problems", formatContextMention({ kind: "problems", path }), path, `${count}`);
  });
  return [all, ...files].filter((entry) => matches(rest, entry.label));
}

function diffItems(rest: string, sources: MentionSources): MentionPickerItem[] {
  const working = [
    item("diff", formatContextMention({ kind: "diff", target: "unstaged" }), "Unstaged changes"),
    item("diff", formatContextMention({ kind: "diff", target: "staged" }), "Staged changes"),
  ];
  const commits = sources.commits.map((commit) => {
    const sha = commit.id.slice(0, COMMIT_SHA_LENGTH);
    const token = formatContextMention({ kind: "diff", target: "commit", sha });
    return item("diff", token, commit.message, sha.slice(0, 7));
  });
  return [...working, ...commits].filter((entry) => matches(rest, entry.label, entry.detail ?? ""));
}

function terminalItems(rest: string, sources: MentionSources): MentionPickerItem[] {
  return sources.terminals
    .filter((session) => hasTerminalOutput(session.id) && matches(rest, session.name))
    .map((session) => {
      const sessionId = session.id.slice(0, TERMINAL_ID_LENGTH);
      return item("terminal", formatContextMention({ kind: "terminal", sessionId }), session.name);
    });
}

function urlItems(rest: string): MentionPickerItem[] {
  const url = rest.trim();
  if (!isHttpUrl(url)) return [];
  return [item("url", formatContextMention({ kind: "url", url }), `Fetch ${url}`)];
}

function skillItems(rest: string, sources: MentionSources): MentionPickerItem[] {
  return sources.skills
    .filter((skill) => skill.error === null && matches(rest, skill.name, skill.id))
    .map((skill) =>
      item(
        "skill",
        formatContextMention({ kind: "skill", id: skill.id }),
        skill.name,
        skill.description,
      ),
    );
}

function emptyHint(kind: ContextMentionKind, rest: string, sources: MentionSources): string {
  switch (kind) {
    case "symbol":
      if (!sources.hasSymbolServer) return "Open a file that has a language server to find symbols";
      return rest.trim() ? "No matching symbols" : "Type a symbol name";
    case "problems":
      return rest.trim() ? "No matching problems" : "No errors or warnings";
    case "diff":
      return "No matching changes or commits";
    case "terminal":
      return rest.trim() ? "No matching terminal tabs" : "No open terminal tabs";
    case "url":
      return "Type a URL that starts with https://";
    case "skill":
      return rest.trim() ? "No matching skills" : "No skills in this workspace";
  }
}

function scopedItems(kind: ContextMentionKind, rest: string, sources: MentionSources) {
  switch (kind) {
    case "symbol":
      return symbolItems(sources);
    case "problems":
      return problemItems(rest, sources);
    case "diff":
      return diffItems(rest, sources);
    case "terminal":
      return terminalItems(rest, sources);
    case "url":
      return urlItems(rest);
    case "skill":
      return skillItems(rest, sources);
  }
}

function useWorkspaceSymbols(query: string | null): LspWorkspaceSymbolItem[] {
  const [symbols, setSymbols] = useState<LspWorkspaceSymbolItem[]>([]);

  useEffect(() => {
    const trimmed = query?.trim();
    const context = symbolSearchContext();
    if (!trimmed || !context) {
      setSymbols([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      lspWorkspaceSymbol(context.language, context.filePath, trimmed)
        .then((result) => {
          if (!cancelled) setSymbols(result);
        })
        .catch(() => {
          if (!cancelled) setSymbols([]);
        });
    }, SYMBOL_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return symbols;
}

function useRecentCommits(enabled: boolean, rootPath: string | null): GitCommit[] {
  const [commits, setCommits] = useState<GitCommit[]>([]);

  useEffect(() => {
    const repoPath = useGitStore.getState().repoPath ?? rootPath;
    if (!enabled || !repoPath) return;
    let cancelled = false;
    invoke<{ commits: GitCommit[] }>("git_log", { repoPath, limit: COMMIT_LIMIT })
      .then((result) => {
        if (!cancelled) setCommits(result.commits);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, rootPath]);

  return commits;
}

/** Picker rows for the context kinds; `query` is the text after `@`, null when no mention is active. */
export function useContextMentionItems(
  query: string | null,
  rootPath: string | null,
): MentionPickerSection | null {
  const scope = query === null ? null : splitMentionQuery(query);
  const kind = scope?.kind ?? null;
  const symbols = useWorkspaceSymbols(kind === "symbol" ? (scope?.rest ?? "") : null);
  const commits = useRecentCommits(kind === "diff", rootPath);
  const problems = useProblemsStore((state) => state.problems);
  const terminals = useTerminalStore((state) => state.sessions);
  const skills = useSkillsStore((state) => state.skills);

  useEffect(() => {
    if (kind === "skill") void useSkillsStore.getState().loadSkills(rootPath);
  }, [kind, rootPath]);

  if (query === null) return null;

  if (!scope) {
    const typed = query.toLowerCase();
    const items = CONTEXT_MENTION_KINDS.filter((entry) => entry.kind.startsWith(typed)).map(
      (entry): MentionPickerItem => ({
        key: `kind:${entry.kind}`,
        token: `${entry.kind}:`,
        label: entry.kind,
        detail: entry.description,
        icon: KIND_ICONS[entry.kind],
        keepOpen: true,
      }),
    );
    return { title: "Context", items, hint: null, scoped: false };
  }

  const sources: MentionSources = {
    rootPath,
    symbols,
    hasSymbolServer: kind === "symbol" && symbolSearchContext() !== null,
    problems,
    commits,
    terminals,
    skills,
  };
  const items = scopedItems(scope.kind, scope.rest, sources);
  return {
    title: KIND_TITLES[scope.kind],
    items,
    hint: items.length === 0 ? emptyHint(scope.kind, scope.rest, sources) : null,
    scoped: true,
  };
}
