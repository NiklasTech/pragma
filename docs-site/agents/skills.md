# Workspace Skills

A skill is a written procedure that agents follow for a recurring job, such as "release a new version" or "add a database migration". Skills are Markdown files in your repository, so they are versioned and shared with your team like any other file.

## Where skills live

Each skill is one file in `.pragma/skills/` of the workspace. The file name without `.md` is the skill id and may only use letters, digits, `-` and `_` (at most 64 characters).

```
.pragma/skills/
  release.md
  add-migration.md
```

## File format

A skill starts with front matter, followed by three headings in this order:

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

| Field         | Required | Notes                                         |
| ------------- | -------- | --------------------------------------------- |
| `name`        | Yes      | Display name                                  |
| `description` | Yes      | One sentence that says when the skill applies |
| `enabled`     | No       | `true` or `false`, defaults to `true`         |

The headings `## Steps`, `## Check` and `## Needs approval` are required. A skill with missing fields or headings is listed with an error and is not offered to agents.

## Create and enable skills

Skills are managed in **Settings > Agents > Skills**:

- **New skill** creates `.pragma/skills/new-skill.md` from the template above and opens it in the editor.
- The switch next to each skill sets its `enabled` field. Enabled skills are offered to every session that does not use a [named agent](./named-agents.md).

A named agent ignores the `enabled` field and uses the skills selected on its own **Skills** tab instead.

## How agents use skills

Pragma does not paste the whole skill into the prompt. The agent receives a list with the name, description and path of each available skill. When a task matches a description, the agent reads the skill file and follows it.

Agents can read skill files freely, but an agent edit to a file in `.pragma/skills/` always needs your approval, even when file edits are otherwise auto-approved.
