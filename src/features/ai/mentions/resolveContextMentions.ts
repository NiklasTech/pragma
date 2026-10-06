import { invoke } from "@tauri-apps/api/core";

import { formatProblemList, selectProblems } from "@/shared/lib/problemsReport";
import { fetchUrlText, formatFetchedUrl } from "@/shared/lib/webFetch";
import { useGitStore } from "@/shared/stores/git";
import { useProblemsStore } from "@/shared/stores/problems";
import { useTerminalStore } from "@/shared/stores/terminal";
import { withLspDocument } from "@/features/agent/lspTools";
import { resolveWorkspacePath } from "@/features/agent/toolInput";
import { relativePath } from "@/features/ai/context/autoContext";
import { skillsDir } from "@/features/ai/skills/paths";
import { lspDocumentSymbol, type LspDocumentSymbolItem } from "@/features/editor/lsp/client";
import { readTerminalOutput } from "@/features/terminal/terminalOutput";

import type { ContextMention } from "./contextMentions";
import { pickSymbolRange } from "./symbolMention";

interface FileReadResult {
  content: string;
}

interface GitDiffResult {
  diff_text: string;
  truncated: boolean;
}

interface MentionSection {
  label: string;
  content: string;
}

const MAX_PROBLEMS = 200;
const MAX_DIFF_CHARS = 20_000;
const MAX_FETCH_CHARS = 50_000;
const MAX_SYMBOL_LINES = 300;
const SYMBOL_FALLBACK_LINES = 40;
const TERMINAL_LINES = 200;

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n... [truncated]` : text;
}

async function symbolSection(
  mention: Extract<ContextMention, { kind: "symbol" }>,
  rootPath: string,
): Promise<MentionSection> {
  const filePath = resolveWorkspacePath(rootPath, mention.path);
  let content: string;
  let symbols: LspDocumentSymbolItem[] = [];
  try {
    ({ content, symbols } = await withLspDocument(filePath, async (language, text) => ({
      content: text,
      symbols: await lspDocumentSymbol(language, filePath),
    })));
  } catch {
    content = (await invoke<FileReadResult>("read_text_file", { path: filePath })).content;
  }

  const lines = content.split("\n");
  const line = mention.line - 1;
  if (line >= lines.length) {
    throw new Error(`${mention.path} has no line ${mention.line}`);
  }
  const range = pickSymbolRange(symbols, mention.name, line) ?? {
    start: line,
    end: line + SYMBOL_FALLBACK_LINES - 1,
  };
  const end = Math.min(range.end, range.start + MAX_SYMBOL_LINES - 1, lines.length - 1);
  const code = lines.slice(range.start, end + 1).join("\n");
  return {
    label: `Symbol ${mention.name} (${mention.path}:${range.start + 1}-${end + 1})`,
    content: `\`\`\`\n${code}\n\`\`\``,
  };
}

function problemsSection(
  mention: Extract<ContextMention, { kind: "problems" }>,
  rootPath: string,
): MentionSection {
  const filePath = mention.path === null ? undefined : resolveWorkspacePath(rootPath, mention.path);
  const problems = selectProblems(
    useProblemsStore.getState().problems,
    ["error", "warning"],
    filePath,
  );
  return {
    label: mention.path === null ? "Problems" : `Problems in ${mention.path}`,
    content:
      problems.length === 0 ? "No errors or warnings." : formatProblemList(problems, MAX_PROBLEMS),
  };
}

async function diffSection(
  mention: Extract<ContextMention, { kind: "diff" }>,
  rootPath: string,
): Promise<MentionSection> {
  const repoPath = useGitStore.getState().repoPath ?? rootPath;
  const result =
    mention.target === "commit"
      ? await invoke<GitDiffResult>("git_show_commit", { repoPath, sha: mention.sha })
      : await invoke<GitDiffResult>("git_diff", {
          repoPath,
          path: null,
          staged: mention.target === "staged",
        });
  const label =
    mention.target === "commit"
      ? `Commit ${mention.sha}`
      : mention.target === "staged"
        ? "Staged changes"
        : "Unstaged changes";
  const diff = result.diff_text.trim();
  return {
    label,
    content: diff ? truncate(diff, MAX_DIFF_CHARS) : "No changes.",
  };
}

function terminalSection(mention: Extract<ContextMention, { kind: "terminal" }>): MentionSection {
  const session = useTerminalStore
    .getState()
    .sessions.find((candidate) => candidate.id.startsWith(mention.sessionId));
  const output = session ? readTerminalOutput(session.id, TERMINAL_LINES) : null;
  if (!session || output === null) {
    throw new Error("The terminal is closed or not open in this window");
  }
  return {
    label: `Terminal ${session.name}`,
    content: output.trim() ? output : "(no output)",
  };
}

async function urlSection(url: string): Promise<MentionSection> {
  const result = await fetchUrlText(url);
  return { label: `Web page ${url}`, content: formatFetchedUrl(result, MAX_FETCH_CHARS) };
}

async function skillSection(id: string, rootPath: string): Promise<MentionSection> {
  const path = `${skillsDir(rootPath)}/${id}.md`;
  const result = await invoke<FileReadResult>("read_text_file", { path });
  return {
    label: `Skill ${id} (${relativePath(rootPath, path)})`,
    content: `Follow this skill for the request.\n\n${result.content.trim()}`,
  };
}

function resolveSection(
  mention: ContextMention,
  rootPath: string,
): MentionSection | Promise<MentionSection> {
  switch (mention.kind) {
    case "symbol":
      return symbolSection(mention, rootPath);
    case "problems":
      return problemsSection(mention, rootPath);
    case "diff":
      return diffSection(mention, rootPath);
    case "terminal":
      return terminalSection(mention);
    case "url":
      return urlSection(mention.url);
    case "skill":
      return skillSection(mention.id, rootPath);
  }
}

/** The context the @symbol, @problems, @diff, @terminal, @url and @skill mentions point to. */
export async function readContextMentions(
  mentions: readonly ContextMention[],
  rootPath: string,
): Promise<string | null> {
  const sections = await Promise.all(
    mentions.map(async (mention) => {
      try {
        return await resolveSection(mention, rootPath);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`@${mention.kind}: ${reason}`);
      }
    }),
  );
  if (sections.length === 0) return null;
  return sections.map((section) => `--- ${section.label} ---\n${section.content}`).join("\n\n");
}
