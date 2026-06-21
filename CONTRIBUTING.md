# Contributing to Pragma

Thanks for your interest in contributing! This guide covers everything you need to get started.

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/) 11.5.0+
- [Rust](https://www.rust-lang.org/tools/install) stable
- Tauri system dependencies for your OS — [see the official guide](https://v2.tauri.app/start/prerequisites/)

### Install and Run

```bash
# Clone the repo
git clone https://github.com/NiklasTech/pragma.git
cd pragma

# Install dependencies
pnpm install

# Start the Tauri dev app
pnpm exec vp dev
```

If you have the Vite+ CLI installed globally, you can also use `vp install` and `vp dev` without the `pnpm exec` prefix.

### Useful Commands

| Command                | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `pnpm exec vp dev`     | Start the Tauri development app           |
| `pnpm exec vp build`   | Build the production frontend             |
| `pnpm exec vp check`   | Run lint, format check and type check     |
| `pnpm exec vp test`    | Run the test suite                        |
| `cargo test`           | Run Rust tests (from `src-tauri/`)        |
| `cargo fmt -- --check` | Check Rust formatting (from `src-tauri/`) |

> If `vp` is installed globally, you can omit the `pnpm exec` prefix.

> Learn more about Vite+ commands in [AGENTS.md](AGENTS.md) or at https://viteplus.dev/guide/.

---

## Branching Model

We use a simple three-tier model:

```
main          ← stable releases only
  ↑
dev           ← active development, integration branch
  ↑
feat/xyz      ← single feature or fix
```

**Branch naming conventions:**

- `feat/<name>` — new feature
- `fix/<name>` — bug fix
- `docs/<name>` — documentation changes
- `chore/<name>` — tooling, dependencies, refactor
- `experiment/<name>` — spike or prototype

**Do not push directly to `main`.** Open a pull request to `dev` instead.

For the full Git workflow, see [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

**Common types:**

| Type       | Use for                                     |
| ---------- | ------------------------------------------- |
| `feat`     | New feature                                 |
| `fix`      | Bug fix                                     |
| `docs`     | Documentation only                          |
| `style`    | Formatting, no logic change                 |
| `refactor` | Code change that is neither feature nor fix |
| `test`     | Tests                                       |
| `chore`    | Tooling, dependencies, build config         |

**Examples:**

```bash
feat(editor): add inline ghost text plugin
fix(terminal): restore cursor position on focus
docs(readme): update install instructions
chore(deps): bump tauri to 2.11.2
```

---

## Pull Request Process

1. Create a feature branch from `dev`.
2. Make your changes and commit using Conventional Commits.
3. Ensure the following checks pass before opening a PR:
   - `pnpm exec vp check`
   - `pnpm exec vp test`
   - `cargo test` (inside `src-tauri/`)
4. Push your branch and open a pull request against `dev`.
5. Fill out the pull request template.
6. Request review from a maintainer.
7. Merge only after approval and green CI.

---

## Code Style

### TypeScript / React

- Use TypeScript strict mode.
- Prefer functional components and hooks.
- Use `pnpm exec vp check` to verify formatting, linting and types.
- If Vite+ is installed globally, you can use `vp check` directly.
- Keep components focused; extract reusable UI to `src/components/ui` or `src/shared/components/ui`.
- State management: prefer Zustand stores in `src/shared/stores`.

### Rust

- Follow the Rust API Guidelines.
- Run `cargo fmt` and `cargo clippy` before committing.
- Tauri commands should return structured errors; avoid panicking in user-facing code.

### Tailwind / CSS

- Use Tailwind utility classes.
- Theme values come from `src/globals.css` and runtime `--pragma-*` CSS variables.

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the full text.

---

## Questions?

- Open a [GitHub Discussion](https://github.com/NiklasTech/pragma/discussions) (once enabled).
- For security issues, see [SECURITY.md](SECURITY.md).
