import { RULES_FILENAMES } from "./rules";

export const PRAGMA_RULES_FILENAME = RULES_FILENAMES[0];

export function pragmaRulesPath(rootPath: string): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/${PRAGMA_RULES_FILENAME}`;
}

export const PRAGMA_MD_TEMPLATE = `# Project Rules

This file is sent with every chat and agent message, so keep it short and specific.

## Project overview

- What the project does and who uses it.
- The main languages, frameworks and entry points.

## Commands

- Install:
- Dev:
- Test:
- Lint and type check:
- Build:

## Conventions

- Follow the patterns already used in the surrounding code.
- Keep changes small and focused on the request.
- Add or update tests when behavior changes.

## Things to avoid

- Do not commit secrets, generated files or local tool state.
- Do not add dependencies without a clear reason.
- Do not reformat code unrelated to the change.

## Notes

Add any project-specific rule that reviewers or agents should always follow.
`;
