# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-05

### Added

- Initial open-source release of Pragma IDE.
- Project foundation with Tauri 2, React 19, TypeScript, Vite+ and pnpm.
- CodeMirror 6 editor with multi-language support and VIM mode.
- xterm.js terminal integration via portable-pty.
- AI chat panel powered by the Vercel AI SDK.
- Inline ghost text and AI diff/edit workflow.
- Git graph and status sidebar panels.
- Git graph context menu with commit actions: view details, copy SHA, checkout, create branch, cherry-pick, revert, and reset (soft/mixed/hard).
- Commit details dialog showing SHA, author, date, parents, full message, and changed files.
- File diff drawer opened from commit details, keeping the commit dialog visible.
- True side-by-side split diff view in `InlineDiff`, powered by CodeMirror `MergeView`.
- Docker container and Compose management in the sidebar.
- MCP server management and tool calling.
- Theme system with built-in and user-loadable themes.
- Settings UI for editor, terminal, AI and theme configuration.
- Font manager for editor and terminal: download open-source monospace fonts or import local `.ttf`/`.otf`/`.woff` files, stored in the app data directory.
- Global pointer cursor for buttons and interactive elements.
- Open-source documentation: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY and CHANGELOG.
- GitHub issue and pull request templates.

### Changed

- Unified diff view now skips diff metadata headers and only renders hunk contents.
- Settings export/import now includes workspace, LSP, experimental features, and custom themes.
- Nested settings objects (editor, terminal, AI providers, LSP, etc.) are deep-merged with defaults on load/import.
- Select and dropdown menus are positioned under their trigger and stay within the viewport.

### Fixed

- Git graph now refreshes automatically after checkout, cherry-pick, revert, reset, and branch creation.
- Git graph pagination no longer appends commits from a previously opened repository.
- Added/deleted files in diff view fall back to unified view when one side is empty.
- Auto Save setting label now shows readable text instead of the raw value.

[Unreleased]: https://github.com/NiklasTech/pragma/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/NiklasTech/pragma/releases/tag/v0.1.0
