# Git Workflow for Pragma

> Simple workflow for solo development without enforced branch protection.
> Discipline instead of enforcement — until the repository is public.

---

## Branch Structure

```
main          ← Stable, clean state only
  ↑
dev           ← Active development, features collect here
  ↑
feat/xyz      ← One feature, one construction site
```

---

## Workflow Step by Step

### 1. Switch to dev (or start a new feature branch)

```bash
git checkout dev
git pull origin dev
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

### 4. Push feature branch

```bash
git push -u origin feat/custom-titlebar
```

### 5. Create a pull request on GitHub

- Base: `dev`
- Compare: `feat/custom-titlebar`
- Self-review, then merge

### 6. Merge into dev

```bash
git checkout dev
git pull origin dev
```

### 7. dev → main (only when clean)

When `dev` is stable and all tests pass:

```bash
# On GitHub: create a PR from dev → main
# Or locally (only if you are sure):
git checkout main
git merge dev
git push origin main
```

> ⚠️ **Rule:** Only merge into `main` when the app builds and runs.

---

## Quick Reference

| Task                   | Command                        |
| ---------------------- | ------------------------------ |
| New feature branch     | `git checkout -b feat/name`    |
| Get current state      | `git pull origin dev`          |
| Push branch            | `git push -u origin feat/name` |
| Switch to dev          | `git checkout dev`             |
| Update dev             | `git pull origin dev`          |
| Merge feature into dev | Via PR on GitHub               |
| Merge dev into main    | Only when clean — via PR       |

---

## Never push directly to main

Until the repository is public and branch protection is active:

```bash
# ❌ Do not do this:
git push origin main

# ✅ Instead:
git checkout dev
# or
git checkout -b feat/...
```

---

## When will it go public?

Once Phase 0 is complete — layout, terminal and editor are running.
Then: repository becomes public → enable branch protection → workflow stays the same.

---

_Status: 2026-06-01_
