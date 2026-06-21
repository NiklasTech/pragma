# Contributing to Pragma

Pragma is a solo-maintained project with a strong product direction. Contributions are welcome, but alignment matters more than volume.

This document helps you decide whether and how to contribute in a way that's likely to get merged, so neither of us wastes time.

---

## How this project is run

- Pragma has one active maintainer ([@NiklasTech](https://github.com/NiklasTech)).
- Review bandwidth is limited.
- Not every contribution can be accepted, even if it's technically correct. Alignment with project direction matters as much as code quality.
- For scope and direction, see the README and open issues. Read them before opening anything non-trivial.

This is normal for a solo project. A "no" on a PR is not personal.

---

## Quick start

```bash
pnpm install
pnpm exec vp dev
```

Prerequisites: Rust (stable), Node.js 24+, pnpm 11.5.0+, plus your platform's [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

If you have the Vite+ CLI installed globally, you can also use `vp dev` without the `pnpm exec` prefix.

---

## Where to discuss

Use GitHub Issues for tracking concrete bugs and features.

For design discussion, scope questions or "should I work on X?", open an issue first. Larger changes require discussion before a PR.

---

## What makes a good contribution

These get merged fast:

- Bug fixes with clear reproduction steps.
- Docs / typos / small UX fixes — open a PR directly.
- Pre-discussed features — alignment in an issue first.
- Small, focused changes — easy to review, low risk.

If your change is small and obvious (typo, narrow bugfix, small docs change), open a PR directly. No issue required.

---

## Keep changes focused

Only change what's needed to accomplish your stated goal.

If you're fixing a bug in `EditorPanel.tsx`, don't also:

- Reformat other files
- Clean up unrelated code
- Fix lint issues in files you didn't need to touch
- Combine multiple unrelated fixes in one PR

Even when these changes are "improvements", they make review harder and slow everything down. If you want to clean things up, open a separate PR after discussion.

**One PR = one logical change.** Multi-concern PRs will be asked to split.

---

## Discuss first (required for larger changes)

For anything beyond a small fix, discussion is required before opening a PR. This includes:

- New features
- UI/UX changes or changes to default behavior
- Refactors or "cleanup" work
- Performance rewrites
- Architectural changes
- Anything touching many files or systems
- New AI providers

Pull requests with significant unsolicited changes will be closed without detailed review. This isn't meant to discourage contribution. It ensures alignment before significant work goes in.

A 10-minute conversation saves a 500-line PR that doesn't fit the roadmap.

---

## Quality bar

Pragma positions itself as lightweight, fast and production-grade. Every PR is reviewed against:

- `pnpm exec vp check` clean
- `pnpm exec vp test` passes
- `cargo clippy` clean and `cargo fmt` applied (inside `src-tauri/`)
- `cargo test` passes (inside `src-tauri/`)
- No perf regressions in known hot paths: terminal renderer, PTY stream, AI streaming, file explorer, editor rendering
- No new heavy dependencies (>50 KB gzip in client bundle, >5 MB compiled on Rust side) without justification
- Platform parity preserved (macOS / Linux / Windows still work)
- Security review for changes to AI tool surface, file system access, network paths and IPC commands

If you're not sure how to measure perf or what counts as a hot path, ask in an issue. Better to confirm than get bounced.

---

## Changes to core subsystems require a test

The most common way a PR breaks Pragma is a local fix with global blast radius: the diff solves one reported case, reads fine, passes checks, and silently breaks the same subsystem in every other case. Review alone does not catch these. A test does.

So if your change touches behavior in any of these load-bearing paths, the PR must add or extend a test that locks the invariant you're relying on:

- Shell/terminal spawn: what shell launches, with which cwd, env and login flags.
- Workspace authorization: which directories spawns, git and AI tools may operate in. Both the allow and the deny side.
- Git command layer: repo-root resolution, pathspec/argument guards, status parsing.
- Filesystem mutation: atomic writes, symlink handling, no-data-loss on partial failure.
- IPC command surface and AI tool surface: anything the webview or the agent can invoke.
- Pure logic with wide reach: cwd inheritance, tab/split tree transforms, OSC/prompt parsing.

The bar for the test is real coverage of the contract, not a placeholder. Test the case that would actually break: the edge, the deny path, the unusual input. If you can't see how to test it, ask in an issue before opening the PR. That conversation is usually shorter than the revert.

UI rendering, themes, syntax-highlight tables, and anything the type-checker already guarantees do not need tests.

---

## What Pragma is not

To set expectations:

- Pragma is not trying to be a full IDE replacement (VS Code, Cursor, Zed).
- Not building: full LSP support, Jupyter notebooks, integrated debugger UI, package manager UI, full web browser.
- This is not a curated "first open-source contribution" project. Beginners are welcome but expect normal review.
- Mechanical refactors, broad style changes and drive-by rewrites are not helpful.
- AI-assisted contributions are welcome, but the PR must reflect understanding of the existing patterns. Low-effort AI-generated code that wasn't read by the author will be closed.

---

## Branches

Branch off `dev`. Use these prefixes (kebab-case):

| Prefix      | Use for                                 |
| ----------- | --------------------------------------- |
| `feat/`     | New feature                             |
| `fix/`      | Bug fix                                 |
| `chore/`    | Refactor, tooling, config, dependencies |
| `docs/`     | Docs-only changes                       |
| `perf/`     | Performance work                        |
| `security/` | Security fix or hardening               |

Examples: `feat/ai-diff-panel`, `fix/terminal-focus`, `security/path-guard`.

Don't open PRs from your fork's `main` or `dev` branch. Work on a feature branch. For the full workflow, see [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

---

## Commits & PRs

The PR title becomes the squash commit for most PRs. Multi-commit PRs with well-crafted atomic commits may be merged with a merge commit at the maintainer's discretion. Titles must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(terminal): add split panes
fix(explorer): prevent input from disappearing on create
chore(deps): bump tauri to 2.11.2
security(ai): tighten path guard
```

Types: `feat`, `fix`, `chore`, `docs`, `perf`, `refactor`, `test`, `build`, `ci`, `security`.

Common scopes: `editor`, `terminal`, `ai`, `explorer`, `sidebar`, `settings`, `git`, `docker`, `mcp`, `theme`, `shell`, `ui`, `windows`, `linux`, `macos`.

Within a PR, individual commit messages can be free-form.

Fill out the PR template. Include: what changed, why, how you tested. Screenshots/GIFs for UI changes. "Tested manually by ..." is the bare minimum.

Open a draft PR early if you want feedback mid-flight. Mark "Ready for review" when done.

---

## What gets merged faster

- Clear problem statement
- Small, focused diff
- Follows existing patterns (read 2–3 nearby files before writing yours)
- All type-checks / lints / tests pass
- Manual testing notes describing the steps you took

---

## What gets bounced back

- Mixed-concern PRs
- Large architectural PRs without prior discussion
- New dependencies without justification
- Breaking changes without migration notes
- Incidental reformatting unrelated to the change
- AI-generated code that obviously wasn't read by the author

---

## Code style

- Follow existing patterns. Read 2–3 adjacent files before adding new ones.
- TypeScript: no `any` unless you really mean it. Strict mode is on.
- Rust: `cargo fmt` + `cargo clippy` clean.
- Comments: only for **why**, not **what**. Code should explain itself. No multi-paragraph docstrings.
- No emojis in code or commit messages.
- American English in user-facing strings.

---

## Project layout

```
src-tauri/                  Rust backend
  src/                      Tauri commands and native modules
  capabilities/             Tauri permission capabilities
  Cargo.toml                Rust dependencies

src/                        React frontend
  app/                      Application shell
  components/               Shared UI components
  features/                 Feature modules
    ai/                     AI chat, agents, tools, providers
    editor/                 CodeMirror editor stack
    terminal/               xterm.js terminal
    sidebar/                Sidebar panels (file explorer, git, docker, mcp)
    settings/               Settings UI and preferences
    run-config/             Run configuration
  shared/                   Shared hooks, stores, utilities
  shell/                    Window chrome and layout
  theme/                    Theme system
```

---

## FAQ

**Q: Should I ask before fixing a typo or obvious bug?**  
A: No, open a PR directly.

**Q: I have an idea for a new feature.**  
A: Open a GitHub issue first. Don't open a PR without prior discussion.

**Q: My PR was closed without detailed feedback.**  
A: Usually means it didn't align with project direction, or scope was too large to review responsibly. This is normal for a solo project. A reopen is welcome if you want to take another pass at a smaller scope.

**Q: Can I work on an open issue?**  
A: Comment first to confirm it's still relevant and nobody else is on it. For anything non-trivial, discuss approach before implementing.

**Q: I noticed cleaner code I could write while working on my fix.**  
A: Focus on your stated goal. Submit cleanup as a separate PR after discussion if it matters.

**Q: How long does review take?**  
A: Depends. Small bug fix or docs: usually within a few days. Larger feature: maybe a week or two. Pre-discussed work moves faster.

**Q: My PR conflicts after `dev` moved. Should I rebase?**  
A: If the change is still relevant and reasonably small, yes. If it's a large stale PR, expect it to be closed with an offer to reopen after rebase. Rotting velocity is real, not personal.

---

## Security issues

Don't file them as public issues. See [SECURITY.md](SECURITY.md).

---

## License

By contributing you agree your work is licensed under [Apache-2.0](LICENSE). No CLA required.
