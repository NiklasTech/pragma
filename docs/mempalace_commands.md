# MemPalace Cheat Sheet

This document contains the important commands for working with the MemPalace memory system in the **Pragma** project.

---

## Setup & Initialization

| Command                     | Description                                                                         |
| :-------------------------- | :---------------------------------------------------------------------------------- |
| `mempalace init .`          | Initialize the current directory as a new **wing**. Scans files and suggests rooms. |
| `mempalace init . --no-llm` | Initialize without a local LLM (Ollama). Uses heuristics for detection.             |
| `mempalace mcp`             | Shows configuration data for MCP clients (Claude, Kimi, Cursor).                    |

## Data Processing (Mining)

| Command                  | Description                                                                            |
| :----------------------- | :------------------------------------------------------------------------------------- |
| `mempalace mine .`       | Indexes all files in the current directory and stores them in the palace.              |
| `mempalace sweep <path>` | Processes conversation transcripts (e.g. from Claude Code) and stores them as drawers. |
| `mempalace status`       | Shows an overview of the current palace, installed wings and rooms.                    |

## Search (Manual)

| Command                                 | Description                                        |
| :-------------------------------------- | :------------------------------------------------- |
| `mempalace search "term"`               | Starts a semantic search across the entire palace. |
| `mempalace search "term" --wing pragma` | Searches only within the Pragma project (wing).    |

## MCP Tools (For Kimi / Claude / IDE)

The AI uses these commands automatically in the background. You can also ask for them explicitly:

- **`mempalace_status`**: Load an overview of the entire memory.
- **`mempalace_search`**: Semantic search for code or concepts.
- **`mempalace_get_drawer`**: Read the exact content of a drawer (file/note).
- **`mempalace_kg_query`**: Query the knowledge graph for relationships between entities.
- **`mempalace_diary_write`**: Instruct Kimi to save a summary of the current session.

## Important Paths

- **Configuration:** `~/Schreibtisch/Coding/pragma/mempalace.yaml`
- **Local database:** `~/.mempalace/palace`
- **MCP executable:** `/home/niklash/.local/bin/mempalace-mcp`

## Project: Pragma

| Property  | Value                                                               |
| :-------- | :------------------------------------------------------------------ |
| **Stack** | Tauri 2 · Rust · React 19 · TypeScript · Vite+ · pnpm · Tailwind v4 |
| **Wing**  | `pragma`                                                            |
| **Rooms** | `src`, `src_tauri`, `public`, `documentation`, `general`            |

### Vite+ Commands (for Pragma)

```bash
pnpm exec vp dev              # Frontend dev server
pnpm exec vp run tauri dev    # Full Tauri app
pnpm exec vp check            # Oxlint + Oxfmt + TypeCheck
pnpm exec vp test             # Vitest
pnpm exec vp run tauri build  # Release build
```

Or use the `pnpm run` shortcuts defined in `package.json`:

```bash
pnpm run dev          # Frontend dev server
pnpm run dev:desktop  # Full Tauri app
pnpm run check        # Oxlint + Oxfmt + TypeCheck
pnpm run test         # Vitest
pnpm run build:desktop # Release build
```

---

_Tip: Run `mempalace mine .` after every larger code change to keep your AI memory up to date._
