# Git Workflow for Pragma

> Public repository workflow: every change lands in `main` through a reviewed,
> checks-passing pull request. Direct pushes to `main` are blocked.

---

## Branch Structure

```
main          ← Stable, protected, only merged via PR
  ↑
feat/xyz      ← One feature, one construction site
```

There is no `dev` branch. Feature and fix branches are created directly from
`main` and merged back into `main`.

---

## Workflow Step by Step

### 1. Make sure `main` is up to date

```bash
git checkout main
git pull origin main
```

### 2. Create a feature branch

```bash
git checkout -b feat/custom-titlebar
```

**Naming conventions:**

- `feat/<name>` — New feature
- `fix/<name>` — Bugfix
- `chore/<name>` — Tooling, docs, refactor
- `experiment/<name>` — Spike, prototype

### 3. Work and commit

```bash
# Commit regularly
git add .
git commit -m "feat: add custom titlebar with window controls"
```

**Commit format (Conventional Commits):**

```
feat:     New feature
fix:      Bugfix
docs:     Documentation
style:    Formatting, no code change
refactor: Code change without new feature / fix
test:     Tests
chore:    Tooling, dependencies, etc.
```

### 4. Push the feature branch

```bash
git push -u origin feat/custom-titlebar
```

### 5. Create a pull request on GitHub

- Base: `main`
- Compare: `feat/custom-titlebar`
- Required status checks must pass:
  - Lint, Format & Type Check
  - Frontend Build
  - Rust Check (Ubuntu)
  - Rust Check (Windows)
- A maintainer / product owner reviews and merges.

### 6. Merge into `main`

Use **Squash and merge** or **Rebase and merge** to keep a linear history.
After merging, delete the feature branch.

---

## Quick Reference

| Task                    | Command                        |
| ----------------------- | ------------------------------ |
| New feature branch      | `git checkout -b feat/name`    |
| Get current state       | `git pull origin main`         |
| Push branch             | `git push -u origin feat/name` |
| Switch to main          | `git checkout main`            |
| Update main             | `git pull origin main`         |
| Merge feature into main | Via PR on GitHub only          |

---

## Never push directly to `main`

`main` is protected by a ruleset. Direct pushes are rejected.

```bash
# ❌ Do not do this:
git push origin main

# ✅ Instead:
git checkout -b feat/...
```

---

## Release tags

When `main` reaches a release-worthy state, a maintainer creates a tag:

```bash
git checkout main
git pull origin main
git tag -a v0.2.0 -m "release: v0.2.0"
git push origin v0.2.0
```

---

_Status: 2026-06-22 — public repository, main-only workflow_
