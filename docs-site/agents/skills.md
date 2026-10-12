# Workspace Skills

A skill is a written procedure that agents follow for a recurring job, such as "release a new version" or "add a database migration". Skills are Markdown files in your repository, so they are versioned and shared with your team like any other file.

## Where skills live

Skills live in `.pragma/skills/` of the workspace, in one of two layouts:

```
.pragma/skills/
  pdf-processing/
    SKILL.md
    scripts/extract.py
  release.md
```

| Layout   | Path                           | Skill id                |
| -------- | ------------------------------ | ----------------------- |
| Standard | `.pragma/skills/<id>/SKILL.md` | Folder name             |
| Legacy   | `.pragma/skills/<id>.md`       | File name without `.md` |

The id may only use letters, digits, `-` and `_` (at most 64 characters). The standard layout follows the open [Agent Skills](https://agentskills.io) format, so a skill folder written for Claude Code, Codex, Copilot, Cursor or Antigravity works in Pragma without changes. Files next to `SKILL.md`, such as scripts, templates or references, belong to the skill.

If a folder and a single file use the same id, the folder wins and the single file is listed with the error "Duplicate skill id".

## File format

### SKILL.md

A `SKILL.md` starts with YAML front matter. The body is free-form Markdown:

```md
---
name: pdf-processing
description: >
  Extract text and tables from PDF files.
  Use when the user works with PDFs.
allowed-tools: [Read, Grep]
---

# PDF processing

Run `scripts/extract.py` on the file and summarize the tables.
```

Multi-line values, lists and nested fields are allowed. Pragma reads `name`, `description` and `enabled` and ignores other fields such as `allowed-tools`, `license` or `metadata`, so they stay available to other tools. The headings Steps, Check and Needs approval are a good structure, but they are not required.

### Single file (legacy)

A single-file skill starts with front matter of one `key: value` per line, followed by three headings in this order:

```md
---
name: Release
description: Use when the user asks to publish a new version.
enabled: true
---

## Steps

1. Bump the version in package.json.
2. Run the test suite.
3. Tag the release commit.

## Check

- All tests pass.
- The tag matches the version.

## Needs approval

- Pushing the tag.
```

The headings `## Steps`, `## Check` and `## Needs approval` are required in this layout.

### Fields

| Field         | Required | Notes                                         |
| ------------- | -------- | --------------------------------------------- |
| `name`        | Yes      | Display name                                  |
| `description` | Yes      | One sentence that says when the skill applies |
| `enabled`     | No       | `true` or `false`, defaults to `true`         |

A skill with missing fields or headings is listed with an error and is not offered to agents. `enabled` is a Pragma field; other tools ignore it.

## Create and enable skills

Skills are managed in **Settings > Agents > Skills**:

- **New skill** creates `.pragma/skills/new-skill/SKILL.md` and opens it in the editor.
- **Convert to SKILL.md** on a single-file skill moves `<id>.md` to `<id>/SKILL.md` without changing its content. The id stays the same, so named agents keep their skill selection.
- The switch next to each skill sets its `enabled` field. Enabled skills are offered to every session that does not use a [named agent](./named-agents.md), including [coding CLI conversations](./coding-clis.md#what-a-conversation-receives).

A named agent ignores the `enabled` field and uses the skills selected on its own **Skills** tab instead.

## How agents use skills

Pragma does not paste the whole skill into the prompt. The agent receives a list with the name, description and path of each available skill. When a task matches a description, the agent reads the skill file and follows it. For a `SKILL.md`, the agent can also open the files in the skill's folder.

Agents can read skill files freely, but an agent edit to a file in `.pragma/skills/`, including files in skill folders, always needs your approval, even when file edits are otherwise auto-approved.
