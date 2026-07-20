# Repository-level Agent Guide

## Project: Pragma IDE

AI-native desktop IDE with Tauri 2, Rust, React 19, TypeScript, CodeMirror 6.

## Tech Stack

- Frontend: React 19, TypeScript, Tailwind CSS v4, CodeMirror 6, xterm.js
- Backend: Rust (Tauri 2), portable-pty
- AI: Vercel AI SDK, MCP Protocol
- State: Zustand | UI: Tailwind + shadcn/ui | Secrets: keyring crate

## Architecture & Important Paths

- `src/features/` — Editor, Terminal, AI Chat, Sidebar, Settings
- `src-tauri/src/` — Rust backend (`lib.rs` = main Tauri setup)
- `src-tauri/tauri.conf.json` / `src-tauri/capabilities/` — Tauri config & capabilities
- `docs/GIT_WORKFLOW.md` — Git workflow | `.github/workflows/ci.yml` — CI

## Superpowers Skills

The Superpowers plugin loads process skills automatically based on the task. When a skill triggers, follow it instead of any ad-hoc process. Skills drive the process; the rules below define the project constraints.

## Strict Rules — NEVER BREAK

1. **No guessing**: Never invent file paths, variables or types. Missing context → read the code or ask.
2. **No `any`**: Absolute type safety in TypeScript.
3. **No God Object**: New features = new files. Do not grow already large files.
4. **No Scope Creep**: Implement exactly the request. No unrequested refactoring.
5. **No Custom UI**: Only established shadcn/ui components and Tailwind utilities.
6. **No direct push to `main`**: Branch from `main` → PR with checks → merge. No `dev` branch. See `docs/GIT_WORKFLOW.md`.
7. **No unnecessary comments**: Max one line, only for complex logic or non-intuitive workarounds.
8. **No Emojis**: Not in code, file names, commit messages or UI text.
9. **Phosphor Icons only**: `@phosphor-icons/react` — never `lucide-react`, `react-icons`, FontAwesome or similar. Replace existing `lucide-react` imports with Phosphor.

## Coding Conventions

- Rust: `Result` + `?` operator, never panic
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Surgical changes: every changed line traceable to the request. Adopt existing style, do not reformat adjacent code. Remove your own orphaned imports/variables.
- Simplicity first: no speculative features or abstractions that were not asked for.

## Workflow

> [!IMPORTANT]
> **Fast-Track**: For trivial tasks (typos, single-line styles, obvious fixes), skip planning and apply surgical changes directly.

1. **Explore first**: Read the full target file before changing it. No exceptions.
2. **Plan when complex**: For architectural or multi-file changes, draft 2-3 sentences before coding.
3. **Write directly**: Use `Write` / `Edit` — do not flood the chat with code. Confirm with the full file path only.
4. **Verify**: Run the verification commands below and show real output — never claim success without evidence.

## Tauri Security by Default

Every new Tauri command must automatically:

- Be registered in Capabilities (`src-tauri/capabilities/`)
- Use exact path scopes only — no `fs:allow-all`
- Validate all inputs on the Rust side (not just the frontend)
- Return `Result<T, E>` — never panic

## Project Commands

| Command                        | `pnpm run` shortcut      | Purpose                   |
| ------------------------------ | ------------------------ | ------------------------- |
| `pnpm exec vp dev`             | `pnpm run dev`           | Frontend dev server       |
| `pnpm exec vp run tauri dev`   | `pnpm run dev:desktop`   | Run full Tauri app        |
| `pnpm exec vp run tauri build` | `pnpm run build:desktop` | Tauri release build       |
| `pnpm exec vp check`           | `pnpm run check`         | Lint + Format + TypeCheck |
| `pnpm exec vp test`            | `pnpm run test`          | Vitest                    |
| `cargo check` / `cargo clippy` | —                        | Rust check / lint         |
| `cargo fmt --check`            | —                        | Rust format check         |

## Verification (before claiming done)

- `pnpm run check` and `pnpm run test` must pass
- `cd src-tauri && cargo check && cargo clippy` for Rust changes

## Git & CI

- Branch from an up-to-date `main`: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Push the branch, open a PR against `main`, required checks must pass, then merge (squash or rebase)
- After every push: `gh pr view <branch> --json statusCheckRollup,mergeStateStatus`
- On `FAILURE`: `gh run view <run-id> --log-failed` → fix → push → recheck until `mergeStateStatus = CLEAN`, then report the PR as ready to merge
