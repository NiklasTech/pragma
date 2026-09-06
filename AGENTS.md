# Repository-level Agent Guide

## Project: Pragma IDE

AI-native desktop IDE with Tauri 2, Rust, React 19, TypeScript, CodeMirror 6.

## Operating model (read first)

This session is the **principal**. DeepSeek Harness is the **worker**. Keep principal tokens low: plan, brief, review. Do not implement non-trivial product code yourself.

| Role      | Who                 | Does                                                                                               |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| Principal | this session (Grok) | talk to the user, explore just enough for a brief, plan, delegate, review diffs, verify, git/PR/CI |
| Worker    | DeepSeek via `dsh`  | edit files, run commands, tests, multi-file implementation                                         |

Do **not** spawn Grok subagents to write product code. That still spends principal tokens. Do **not** drive `http://127.0.0.1:3080/` (web UI is cookie-gated). Do **not** paste worker transcripts or whole files back into this chat.

### You act directly only when

- Fast-track: typos, one-line style, obvious one-file fixes, edits to this guide
- Questions, design, review, git/PR/CI
- The worker cannot start (then say so and implement yourself)

### Delegate everything else

1. Explore the **minimum** real paths (no guessing). Do not dump file bodies into the brief.
2. Hand each worker a brief under ~40 lines: goal, paths, constraints (`AGENTS.md` rules), done-when, **model + effort**. Fan out independent simple slices as separate `flash`+`low` workers.
3. After it returns: `git diff` + verification commands. Review the diff, not the whole tree.
4. Fail once → one retry brief with the error. Still wrong → you fix only the leftover, surgically.

### Worker invoke

The principal **starts `dsh` itself** as a subprocess for each job. Do not ask the user to launch `dsh web` and do not attach to `:3080`. The Web UI is optional and a different profile; headless/ACP sessions do not appear there.

Cwd = repo root. Credentials come from `$DSH_HOME` (default `~/.dsh`) or `DEEPSEEK_API_KEY` — the same store the Web UI uses, but no running Web process is required. First `npx` call may be slow; later calls reuse the cache.

- **One-shot (default from this CLI):**

```
npx --yes @deepseek-ai/dsh --profile headless "<brief>"
```

- **Multi-turn / cancel / resume / parallel sessions:** `npx --yes @deepseek-ai/dsh --profile acp` then one `session/new` per worker (absolute cwd) → `session/set_config_option` for `model` and `reasoning_effort` → `session/prompt`. Auto-allow writes inside this repo; reject anything outside it. Prefer **one ACP process with N sessions** over N headless boots.

Use a long command timeout. If the worker blocks on permission, do not sit on it — retry with an explicit allow in the brief or continue yourself.

### Model and effort

Provider: `deepseek-official`. Put the pair in **every** brief / session — cheap tasks must not inherit `high`.

| Work                                                                       | Model               | Effort |
| -------------------------------------------------------------------------- | ------------------- | ------ |
| Simple, local, well-specified (rename, one function, test, copy a pattern) | `deepseek-v4-flash` | `low`  |
| Default implementation                                                     | `deepseek-v4-flash` | `high` |
| Architecture, hard bugs, large refactors                                   | `deepseek-v4-pro`   | `high` |
| Worker stuck after a retry                                                 | `deepseek-v4-pro`   | `max`  |
| Tiny lookup the worker must do                                             | `deepseek-v4-flash` | `off`  |

Effort values: `off` (no thinking), `low`, `high` (default for mixed work), `max`. A change mid-turn applies to the **next** turn only.

### Parallel workers

Split only **independent** slices (different files, no shared types/imports you are changing). Cap at **3** concurrent workers. Each slice gets its own brief and its own model/effort — simple slices stay `flash` + `low`.

Do not run two workers on the same file. Sequential if they would touch the same module. After they return: one combined `git diff`, then verify once. You merge conflicts; workers do not.

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
> **Fast-Track**: For trivial tasks (typos, single-line styles, obvious fixes), skip planning and apply surgical changes directly (principal). Everything else goes to the DeepSeek worker; you only review and verify.

1. **Explore first**: Read the full target file before changing it, or before writing the worker brief. No exceptions.
2. **Plan when complex**: For architectural or multi-file changes, draft 2-3 sentences, then delegate. Do not start implementing in this session.
3. **Delegate, then review**: Worker writes the code. You confirm with paths + `git diff`. Do not flood the chat with code or worker logs.
4. **Verify**: Run the verification commands below (or confirm the worker's output) — never claim success without evidence.

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

## Releases & Versioning

Semantic Versioning (`MAJOR.MINOR.PATCH`), currently 0.x — breaking changes are acceptable until 1.0.0:

- **Versions bump per release, not per PR.** Features accumulate on `main`; a release bundles whatever is merged by then. Do not cut a release after every single feature.
- Release contains any new feature → bump **minor** (0.2.0 → 0.3.0, patch resets to 0)
- Only fixes/chores/dependencies → bump **patch** (0.2.0 → 0.2.1)
- Release cadence is a judgment call: ship a minor release when a meaningful bundle of features is ready, ship patch releases anytime a fix should go out. Ten merged features must not mean ten releases.
- **No release without an explicit user request.** Merging to `main` never triggers a version bump or release on its own. When the user asks for a feature or fix, implement it, label the PR, merge — done. Do not propose or start the release process unless the user explicitly asks for a release.
- **Label every PR immediately at creation** so Release Drafter accumulates changes correctly and resolves the next version from the draft: `feat`/`feature`/`enhancement` → minor, `fix`/`bug` → patch, `chore`/`refactor`/`dependencies` → patch (see `version-resolver` in `.github/release-drafter.yml`). Without labels it always falls back to patch. The release decision is made later from the accumulated draft — what is bundled, not what a single PR contains.

Release process:

1. Bump the version in all three places — `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` — on a `chore/release-vX.Y.Z` branch with PR (run `cd src-tauri && cargo check` to sync `Cargo.lock`). Also run `pnpm run generate:licenses` so `public/third-party-licenses.json` covers all current dependencies.
2. Rename the Release Drafter draft to the target version (tag `vX.Y.Z`, title `Pragma X.Y.Z`).
3. After the PR is merged, tag the merge commit on `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The tag push triggers `.github/workflows/release.yml` (Windows/Linux/macOS matrix), which builds the app and attaches the artifacts to the draft release. Publish the draft once all three platform builds are green.
