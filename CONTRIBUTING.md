# Contributing to Pragma

Pragma is a solo-maintained project with a clear product direction. Contributions are welcome — but alignment matters more than volume. This document helps you decide whether and how to contribute in a way that's actually likely to get merged, so neither of us wastes time.

---

## How this project is run

- One active maintainer ([@NiklasTech](https://github.com/NiklasTech))
- Review bandwidth is limited
- Not every contribution can be accepted, even if it's technically sound — alignment with project direction matters as much as code quality
- A "no" on a PR is not personal; it's usually a scope or direction issue

Read the README and open issues before starting anything non-trivial.

---

## Before you start

| Change type                                | What to do first                                        |
| ------------------------------------------ | ------------------------------------------------------- |
| Typo, narrow bugfix, small docs fix        | Open a PR directly — no issue needed                    |
| Bug with a clear reproduction              | Open an issue or PR directly                            |
| New feature or behavior change             | Open an issue and discuss first                         |
| Refactor, cleanup, or architectural change | Open an issue — required                                |
| New AI provider or auth model              | Open an issue — required                                |
| New MCP server integration                 | Open an issue — required                                |
| Security vulnerability                     | See [SECURITY.md](./SECURITY.md) — do not file publicly |

A 10-minute conversation in an issue saves a 500-line PR that doesn't fit the roadmap.

---

## Setup

**Prerequisites**

- Rust (stable)
- Node.js 24+
- pnpm 11.5.0+
- Platform Tauri 2 prerequisites → [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

**Install and run**

```bash
pnpm install

# Start the frontend development server
pnpm exec vp dev

# Start the full Tauri desktop app
pnpm exec vp run tauri dev
```

If you have the Vite+ CLI installed globally:

```bash
vp dev
vp run tauri dev
```

> **Shortcut:** The same commands are available via `pnpm run`:
>
> ```bash
> pnpm run dev          # frontend dev server
> pnpm run dev:desktop  # full Tauri desktop app
> pnpm run check        # lint + format + type check
> pnpm run test         # run tests once
> ```

> Pragma targets a binary size under 15 MB. Keep that in mind when pulling in new dependencies.

---

## Branch and commit conventions

Branch off `dev`. Use these prefixes in kebab-case:

| Prefix      | Use for                                 |
| ----------- | --------------------------------------- |
| `feat/`     | New feature                             |
| `fix/`      | Bug fix                                 |
| `chore/`    | Refactor, tooling, config, dependencies |
| `docs/`     | Docs-only changes                       |
| `perf/`     | Performance work                        |
| `security/` | Security fix or hardening               |

Examples: `feat/mcp-server-manager`, `fix/terminal-split-focus`, `security/ai-path-guard`

Don't open PRs from your fork's `main` or `dev` branch — always work on a feature branch.

**Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):**

```
feat(mcp): add server lifecycle management
fix(terminal): restore focus after split close
feat(ai): add Ollama provider support
chore(deps): bump tauri to 2.11.2
security(ai): tighten workspace path guard
```

Types: `feat` `fix` `chore` `docs` `perf` `refactor` `test` `build` `ci` `security`

Scopes: `editor` `terminal` `ai` `explorer` `sidebar` `settings` `git` `docker` `mcp` `theme` `shell` `run-config` `local-history` `ui` `windows` `linux` `macos`

Individual commits within a PR can be free-form — the PR title becomes the squash commit message, so that one needs to follow the convention.

---

## Quality bar

Every PR is checked against:

- `pnpm exec vp check` passes clean
- `pnpm exec vp test` passes
- `cargo clippy` clean and `cargo fmt` applied (inside `src-tauri/`)
- `cargo test` passes (inside `src-tauri/`)
- No performance regressions in known hot paths: terminal renderer, PTY stream, AI streaming, file explorer, CodeMirror editor
- No new heavy dependencies (>50 KB gzip client-side, >5 MB compiled Rust-side) without justification — binary size budget is real
- Platform parity maintained — macOS, Linux, and Windows still work
- Security review for any changes to AI tool surface, MCP server communication, filesystem access, network paths, or IPC commands

---

## When your change touches core subsystems — add a test

The most common way a PR breaks Pragma is a fix that solves one case and silently breaks the same subsystem everywhere else. Review alone doesn't catch this. A test does.

If your change touches any of the following, the PR **must** include a test that locks the invariant you're relying on:

- **Shell / terminal spawn** — what shell launches, with which cwd, env, and login flags; affects every terminal tab and split
- **Workspace authorization** — which directories spawns, git, and AI tools may operate in; both the allow and deny paths
- **Git command layer** — repo-root resolution, pathspec/argument guards, status parsing, smart checkout with auto-stash
- **MCP server lifecycle** — start/stop/restart behavior, JSON-RPC communication, tool registration for the AI chat
- **Filesystem mutation** — atomic writes, symlink handling, local history snapshots, no data loss on partial failure
- **IPC and AI tool surface** — anything the webview or agent can invoke
- **Pure logic with wide reach** — cwd inheritance, tab/split tree transforms, OSC/prompt parsing, run configuration resolution

The bar is real coverage of the contract — not a placeholder. Test the edge case, the deny path, the unusual input. If you're not sure how to test something, ask in an issue before opening the PR. That conversation is usually shorter than the revert.

UI rendering, themes, syntax-highlight tables, and anything the type-checker already guarantees don't need tests.

---

## Keep changes focused

Only change what's needed to accomplish your stated goal. If you're fixing a bug in `EditorPanel.tsx`, don't also reformat unrelated files, clean up nearby code, or bundle in a second fix.

Even when those changes are improvements, they make review harder and slow everything down. If you want to clean something up, open a separate PR after discussion.

**One PR = one logical change.** Multi-concern PRs will be asked to split.

---

## Code style

- **Follow existing patterns.** Read 2–3 adjacent files before adding new ones.
- **TypeScript:** no `any` unless you genuinely mean it. Strict mode is on.
- **Rust:** `cargo fmt` + `cargo clippy` clean before every push.
- **React:** functional components and hooks only; no class components. Zustand for state — don't reach for Context unless the store doesn't fit.
- **Theming:** use CSS variables from the token system (`bg-root`, `fg-default`, `primary`, etc.) — no hardcoded colors.
- **Comments:** explain _why_, not _what_. Code should explain itself.
- **No emojis** in code or commit messages.
- **American English** in all user-facing strings.

---

## Pull request process

1. **Open a draft PR early** if you want mid-flight feedback — don't wait until it's perfect
2. **Fill out the PR template** — what changed, why, how you tested it
3. **Screenshots or GIFs** for any UI change — "tested manually by..." is the bare minimum
4. **Mark ready for review** when the checklist is done
5. **If `dev` moves under you** — rebase if the change is still small and relevant; large stale PRs may be closed with an offer to reopen after rebase

**What gets merged fast:**

- Clear problem statement
- Small, focused diff
- Follows existing patterns
- All checks pass
- Manual testing described

**What gets bounced back:**

- Mixed-concern PRs
- Large architectural changes without prior discussion
- New dependencies without size justification
- Breaking changes without migration notes
- Incidental reformatting unrelated to the stated change
- AI-generated code that clearly wasn't read by the author before submitting

---

## What Pragma is not

- **Not a VSCode replacement** — Pragma has its own scope and identity; contributions that push it toward becoming another general-purpose editor won't land
- **Not an Electron app** — performance and binary size are first-class constraints; anything that compromises them needs extraordinary justification
- **Not building:** full LSP beyond what CodeMirror 6 supports today, Jupyter notebooks, integrated debugger UI, package manager UI, embedded browser
- **Not a plugin marketplace** — the MCP server manager is the extensibility story; a separate plugin SDK is on the roadmap but not open for contribution yet
- Mechanical refactors, broad style passes, and drive-by rewrites are not helpful contributions
- AI-assisted contributions are welcome — but the PR must reflect genuine understanding of the existing patterns

---

## FAQ

**Should I ask before fixing a typo or obvious bug?**
No — open a PR directly.

**I have an idea for a new feature.**
Open an issue first. Don't open a PR for a new feature without prior discussion.

**I want to add a new AI provider.**
Pragma supports four auth models (CLI subscription, API key, Ollama, GitHub Copilot OAuth). Before implementing a new provider, open an issue to confirm it isn't already covered by the existing Ollama or API key flows, and that it fits Pragma's provider strategy.

**I want to add a new MCP server.**
Open an issue. Pragma's MCP manager handles lifecycle — new server types need discussion around JSON-RPC surface, security implications, and UX before a PR makes sense.

**My PR was closed without detailed feedback.**
Usually means it didn't align with project direction, or the scope was too large to review responsibly. A reopen is welcome if you want to take another pass at a smaller scope.

**Can I work on an open issue?**
Comment first to confirm it's still relevant and nobody else is on it. For anything non-trivial, discuss your approach before implementing.

**I noticed other code I could improve while working on my fix.**
Focus on your stated goal. Submit cleanup as a separate PR after discussion if it matters.

**How long does review take?**
Small bugfix or docs: usually within a few days. Larger feature: a week or two. Pre-discussed work moves faster.

**My PR conflicts after `dev` moved. Should I rebase?**
If the change is still relevant and reasonably small — yes, rebase. Large stale PRs may be closed with an offer to reopen after rebase.

---

## License

By contributing you agree your work is licensed under [Apache-2.0](./LICENSE). No CLA required.
