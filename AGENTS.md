# Repository-level Agent Guide

This file is the single source of truth for working on Pragma. It is loaded automatically at every session start — follow it in full.

## Project: Pragma IDE

AI-native desktop IDE with Tauri 2, Rust, React 19, TypeScript, CodeMirror 6.

## Tech Stack

- Frontend: React 19, TypeScript, Tailwind CSS v4, CodeMirror 6, xterm.js
- Backend: Rust (Tauri 2), portable-pty
- AI: Vercel AI SDK, MCP Protocol
- State: Zustand | UI: Tailwind + shadcn/ui | Secrets: keyring crate

## Architecture & Important Paths

- `src/` — React frontend
- `src/features/` — Editor, Terminal, AI Chat, Sidebar, Settings
- `src-tauri/src/` — Rust backend (`lib.rs` = main Tauri setup)
- `src-tauri/tauri.conf.json` — Tauri config
- `src-tauri/capabilities/` — Tauri capabilities
- `docs/` — Documentation (`GIT_WORKFLOW.md`, `KIMI_PROMPT.md` task template)
- `.github/workflows/ci.yml` — CI

## Superpowers Skills (installed — follow them)

The Superpowers plugin loads process skills automatically based on the task. When a skill triggers, follow it instead of any ad-hoc process:

| Situation                              | Skill                                     |
| -------------------------------------- | ----------------------------------------- |
| New feature / behavior change          | `brainstorming` — before writing any code |
| Bug, test failure, unexpected behavior | `systematic-debugging` — root cause first |
| Implementation work                    | `test-driven-development`                 |
| Multi-step task with a spec            | `writing-plans` → `executing-plans`       |
| Before claiming "done"                 | `verification-before-completion`          |
| Integrating finished work              | `finishing-a-development-branch`          |

Skills drive the process; the rules below define the project constraints.

## Strict Rules — NEVER BREAK

1. **No guessing**: Never hallucinate file paths, variables or types. Missing context → use `mempalace` tools or ask.
2. **No `any`**: Absolute type safety in TypeScript. Missing types must be defined strictly.
3. **No God Object**: Do not stuff new logic into already large files. New features = new files.
4. **No Scope Creep**: Implement exactly the requested issue. No unrequested refactoring.
5. **No Custom UI unless necessary**: Only established shadcn/ui components and Tailwind utilities.
6. **No direct push to `main`**: Branch from `main` → PR with checks → merge into `main`. There is no `dev` branch. See `docs/GIT_WORKFLOW.md`.
7. **No unnecessary comments**: Max one line, only for complex business logic or non-intuitive workarounds.
8. **Security First**: Built in from the start — never a later patch.
9. **No Emojis**: Not in code, file names, commit messages or UI text.
10. **Phosphor Icons only**: `@phosphor-icons/react` — never `lucide-react`, `react-icons`, FontAwesome or similar. Replace existing `lucide-react` imports with Phosphor.
11. **Fit the architecture**: Read the project docs (`mempalace` tools or `Read`) before implementing. No features outside the current scope without explicit approval.

## Coding Conventions

- React 19 strict TypeScript, functional components + hooks
- CodeMirror 6 for the editor (not Monaco)
- Rust: `Result` + `?` operator, never panic
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Surgical changes: every changed line traceable to the request. Do not reformat or "improve" adjacent code; adopt existing style. Remove your own orphaned imports/variables.
- Simplicity first: no speculative features, abstractions or "flexibility" that was not asked for.

## Workflow

> [!IMPORTANT]
> **Fast-Track**: For trivial tasks (typos, single-line styles, obvious fixes), skip the planning phase and apply surgical changes directly.

1. **Explore first**: `mempalace_status` / `mempalace_search` for context, `mempalace_kg_query` for entity relationships. Read the full target file (`Read` or `mempalace_get_drawer`) before changing it. No exceptions.
2. **Plan when complex**: For architectural or multi-file changes, draft 2-3 sentences before coding. Otherwise, execute directly.
3. **Write directly**: Use `Write` / `Edit` — do not flood the chat with code. Confirm in chat with the full file path only.
4. **Verify**: Run the verification commands below and show the output.
5. **On failure**: No apologies. Root cause via `systematic-debugging`, fix directly, report only the delta.

## Tauri Security by Default

Every new Tauri command must automatically:

- Be registered in Capabilities (`src-tauri/capabilities/`)
- Use exact path scopes only — no `fs:allow-all`
- Validate all inputs on the Rust side (not just the frontend)
- Return `Result<T, E>` — never panic

## Icons

Only `@phosphor-icons/react`:

```tsx
import { Gear, Terminal } from "@phosphor-icons/react";

<Gear size={20} weight="bold" />;
```

Available weights: `thin`, `light`, `regular`, `bold`, `fill`, `duotone`

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
- Run the checks and show real output — never claim success without evidence

## Memory (mempalace)

- Session start: `mempalace_status` / `mempalace_search` for project context
- After creating new files: `mempalace mine .`
- After architecture decisions: draft a `mempalace_diary_write` entry

## Git & CI

- Main-only workflow per `docs/GIT_WORKFLOW.md` — no `dev` branch, no direct push to `main`
- Branch from an up-to-date `main`: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Push the branch, open a PR against `main`, required checks must pass, then merge (squash or rebase)
- After every push: `gh pr view <branch> --json statusCheckRollup,mergeStateStatus`
- On `FAILURE`: `gh run view <run-id> --log-failed` → fix → push → recheck until `mergeStateStatus = CLEAN`, then report the PR as ready to merge
