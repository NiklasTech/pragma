# Repository-level Agent Guide

## Project: Pragma IDE

AI-native desktop IDE with Tauri 2, Rust, React 19, TypeScript, CodeMirror 6.

## Tech Stack

- Frontend: React 19, TypeScript, Tailwind CSS v4, CodeMirror 6, xterm.js
- Backend: Rust (Tauri 2), portable-pty
- AI: Vercel AI SDK, MCP Protocol

## Architecture

- src/ — React frontend
- src-tauri/src/ — Rust backend
- src-tauri/src/lib.rs — Main Tauri setup
- src/features/ — Editor, Terminal, AI Chat, Sidebar, Settings

## Coding Rules

- React 19 strict TypeScript, functional components + hooks
- Zustand for state, Tailwind + shadcn/ui for UI
- CodeMirror 6 for editor (not Monaco)
- Rust: Result + ? operator, keyring crate for secrets
- Conventional commits: feat:, fix:, refactor:, docs:

## Verification

- pnpm run check
- cd src-tauri && cargo check && cargo clippy
- pnpm run test && cargo test
