# Pragma UI Rework — Design Spec

> **Status:** Draft, awaiting user review before the implementation plan.
> **Date:** 2026-09-11
> **Canonical path:** `docs/UI_REWORK.md` (tracked). `docs/superpowers/` is gitignored in this repo — do not put the source of truth there.
> **Branch policy:** Implement on `feat/` branches from `main`. Never push `main` directly.
> **This file is the source of truth.** If a later session is compacted or a new agent picks up the work, read this spec before touching UI.

## Goal

Pragma stops being “a code editor with AI bolted on” and becomes one **allrounder product** with two modes in a single window:

- **Agents** — thread-first workspace for directing AI (BB / Cursor Agents Window / BridgeMind Agent mode).
- **Editor** — full hands-on IDE (VS Code / Terax craft: files, LSP, git, terminal, debug).

One visual language through the whole app. Shared components carry radius, depth, type, and state. Themes may change **color** later; they must not change **structure**.

## Success criteria

- A user can tell it is the same product in Agents and in Editor (chrome, type, radius, elevation, icons).
- Agents is not “the chat drawer”. It is a first-class workspace: thread list, transcript, composer, collapsible review pane.
- Editor is not a VS Code skin. Same chrome as Agents; navigation is a single sidebar with an internal switcher, not an activity-bar icon rail.
- Beginners can start a thread from a large composer. Experts keep command palette, splits, shortcuts, and dense panels.
- After this rework, a new feature is added by composing existing primitives, not by inventing a new look.

## Non-goals (v1 of this rework)

- Named persistent “teammate” agents (BridgeMind personas, routines, faces).
- Parallel agent runs (multiple live executors). The **list** can hold many threads; **one** run is active.
- Tiled/canvas multi-agent grid.
- Cloud agents, mobile, or a third Chat app-mode.
- Replacing CodeMirror, xterm, the layout tree, LSP, DAP, or git backends.
- New icon set (Phosphor stays). No lucide-react, no emojis in UI or copy.
- Shipping a release / version bump.

## Key decisions

| Decision              | Choice                                                                                            | Why                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Product model         | One window, titlebar switch **Agents \| Editor**                                                  | BridgeMind pattern. User’s preferred chrome. Cursor’s two-window split is more product to maintain.                      |
| Visual language       | App-like: dark, calm, rounded, layered depth                                                      | BridgeMind look; Terax editor craft underneath. Kill VS Code 2018 chrome and neon button glow.                           |
| Agents primary object | Threads per workspace                                                                             | BB/Cursor. Named agents are a later product, not this rework.                                                            |
| Agents layout         | Three columns, right pane collapsible                                                             | Max information without permanent overload. Right pane default **open** when a run has diffs/approvals, else **closed**. |
| Launch                | Remember last mode. Cold start: Agents home if no folder, Editor if opened with a folder/CLI path | Respects both jobs.                                                                                                      |
| Editor nav            | One sidebar, internal switcher (Files / Git / Search / Debug / …)                                 | Terax. No activity-bar rail.                                                                                             |
| Tokens                | Signature Dark + Light. Existing themes become color skins **after** chrome/components land       | Structure first; skins second.                                                                                           |
| Components            | Restyle primitives (radius, elevation, spacing, states), not colors only                          | The current mix is structure, not just palettes.                                                                         |
| v1 Agents capability  | Shell + today’s AI, correct IA                                                                    | Multiple stored threads, one live run. Chat + Agent merge into one thread model (Ask / Agent already exist).             |
| Implementation order  | Foundation first                                                                                  | Tokens + shared UI, then chrome, then Editor shell, then Agents shell + migrate chat.                                    |

---

## Current state (why it feels mixed)

Pragma already has a real token file (`src/globals.css`) and shadcn/Base UI primitives. The mix is **application**, not missing variables:

- **Editor chrome** still reads as VS Code: icon dock, 24px statusbar, “open a file” void, titlebar as a mini menubar.
- **Sidebar dock** (`Sidebar.tsx`) is a rounded-xl bordered card of icons — a third language between VS Code rail and an app rail.
- **Buttons** use accent **glow** (`shadow-[0_0_20px_-4px_var(--color-accent-glow)]`). BridgeMind/BB/Cursor do not glow primary buttons.
- **AI is a placement**, not a workspace: drawer left/right, bottom sheet, floating, editor tab (`aiPlacement.ts`). ChatPanel and AgentPanel are two products.
- **Empty states** are stubs (`WelcomePanel`, `ChatEmptyState`).
- **Settings** already look more “app” than the editor — that split is the complaint.

Reference surfaces studied (local + public):

- **BB** (`C:\Users\haeus\Desktop\Coding\Work\bb`): thread list + transcript + secondary tools; dense, muted, professional.
- **Terax** (`C:\Users\haeus\Desktop\Coding\terax-ai`): editor craft, unified header, agent as overlay, Files/Source Control switcher in the sidebar footer.
- **BridgeMind** (https://www.bridgemind.ai/): Agent \| Code \| Chat switch in the titlebar; left rail; composer with model/effort; dark-first, rounded, calm.
- **Cursor 3 Agents Window**: thread/session list, chat + file/diff, switch back to IDE.
- **VS Code 1.12x Agents window**: sessions left, chat center, changes right; editor still classic IDE.
- **JetBrains**: agent lives in the existing tool-window chrome (not the target look).

---

## Product model

```
+------------------------------------------------------------------+
| Titlebar: logo  workspace   [ Agents | Editor ]    settings  win |
+------------------------------------------------------------------+
| Mode body (Agents workspace  OR  Editor workspace)               |
+------------------------------------------------------------------+
| Statusbar (same component, quieter; items depend on mode)        |
+------------------------------------------------------------------+
```

- The switch changes the **body**, not the window, tokens, or component set.
- Both modes share: Titlebar, Statusbar, Command Palette, dialogs, toasts, settings overlay.
- There is **no third Chat mode**. Ask vs Agent is a composer control (already in `ChatToolbar`).

### Launch

Persist `pragma.ui.mode` = `agents` | `editor`.

| Situation                       | Mode                         |
| ------------------------------- | ---------------------------- |
| Returning user                  | Last mode                    |
| First run, no folder            | Agents home (large composer) |
| Opened with folder / `pragma .` | Editor, that workspace       |

### Editor ↔ Agents handoff

- **Open in Editor** from an Agents thread: switch mode, focus the file/diff the thread last touched.
- **Ask Agents** from Editor: switch mode, or dock the **active thread** on the editor’s right (same composer, not a second chat product).
- Default Editor layout has **no** chat docked. A titlebar/composer button and a shortcut (reuse today’s AI toggle) docks the active thread.
- Do not keep floating / bottom-sheet / AI-as-editor-tab as first-class placements in v1. Remove or hide those placement options from Settings Layout once the dock + mode switch exist. Layout-tree docking of an `ai` panel may remain internally for the editor-right dock only.

---

## Visual language

Calm dark app. Layered surfaces. Rounded, not squircles-on-everything. Depth from **surface steps + hairline borders + one shadow level**, not neon.

### Type

Keep Geist / Geist Mono (already in `globals.css`).

| Token            | Size | Use                             |
| ---------------- | ---- | ------------------------------- |
| `--text-ui-2xs`  | 10px | badges, vim, counts             |
| `--text-ui-xs`   | 11px | sidebar rows, statusbar, helper |
| `--text-ui-sm`   | 12px | section labels, composer meta   |
| `--text-ui-base` | 13px | body UI, messages, tree         |
| `--text-ui-md`   | 14px | composer input, titles          |
| `--text-ui-lg`   | 16px | empty-state title, home         |

Do not introduce a second UI font.

### Radius (apply consistently)

Keep the scale, **use larger steps on chrome**:

| Token           | Value  | Use                                                |
| --------------- | ------ | -------------------------------------------------- |
| `--radius-xs`   | 4px    | chips, kbd                                         |
| `--radius-sm`   | 6px    | icon buttons, tree rows                            |
| `--radius-md`   | 8px    | buttons, inputs, tabs                              |
| `--radius-lg`   | 12px   | sidebar, panels, dialogs, cards                    |
| `--radius-xl`   | 16px   | composer shell, home prompt, settings window       |
| `--radius-pill` | 9999px | segmented control (Agents \| Editor), count badges |

The mode switch is a **pill segmented control**. Panels are `--radius-lg`. The composer is `--radius-xl`.

### Elevation (new tokens — add to `globals.css` + theme JSON)

| Token           | Role                                  |
| --------------- | ------------------------------------- |
| `--bg-root`     | window                                |
| `--bg-surface`  | sidebar, statusbar, panel chrome      |
| `--bg-elevated` | titlebar, popovers, composer, dialogs |
| `--bg-input`    | fields                                |
| `--shadow-sm`   | composer, dropdown                    |
| `--shadow-md`   | dialog, settings                      |

Default dark values (signature theme; may refine at implementation, not per-component):

- root `#0b0d10`, surface `#101318`, elevated `#161a21` (already close — keep family)
- borders stay hairline (`rgba(255,255,255,0.06)`)
- `--shadow-sm`: `0 4px 16px rgba(0,0,0,0.28)`
- `--shadow-md`: `0 12px 40px rgba(0,0,0,0.45)`

**Kill button glow.** Primary is solid accent fill, no `accent-glow` shadow on default buttons. Glow may remain only as a focus ring (`--border-focus`).

### Color

Keep the Pragma indigo accent `#6e7bf2` as identity. Status/git colors stay. Light theme is a first-class token map (not an afterthought invert).

### Icons

Phosphor only. Regular weight at rest, duotone or fill for active. 16px in chrome, 13–14px in rows.

### Motion

Existing `--motion-fast/base/slow`. Mode switch: crossfade body 200ms, no page flip. Right Agents pane: width collapse, not unmount if it has state.

---

## Shared chrome

### Titlebar (`src/shell/chrome/Titlebar.tsx`)

Height stays `--chrome-header-h` (40px) in both modes. The mode pill is `h-7` (`--radius-pill`) so it fits without growing the bar.

**Left:** app icon, workspace/folder name (truncated), optional git branch as muted text (not a VS Code status color block).

**Center:** segmented control `Agents` | `Editor`. Keyboard: document a shortcut in Settings (e.g. `Ctrl+Shift+E` cycle, or two commands). Command Palette: “Switch to Agents”, “Switch to Editor”.

**Right:** settings, then window controls (Windows). No File/Open icon cluster as the visual identity; Open Folder lives in a workspace menu on the folder name.

Drag region: full titlebar except interactive controls (`data-tauri-drag-region` as today).

### Statusbar (`src/shell/chrome/Statusbar.tsx`)

Keep one bar. Quiet: `--text-ui-xs`, `--fg-muted`, no loud VIM green slab unless vim is on (then a small pill).

- Editor: ln/col, language, branch, problems, model (click → Agents or model popover).
- Agents: thread status, model, token/run hint if we already have it, branch of the workspace.

### Command palette / Go to file / dialogs

Same primitives. Dialogs use `--radius-lg`, `--bg-elevated`, `--shadow-md`. No one-off modal skins.

---

## Agents workspace

Three columns. Same tokens as Editor.

```
+------------------+---------------------------+------------------+
| Thread list      | Transcript                | Context          |
| ~240–280px       | flex                      | ~320–400px       |
|                  | Composer at bottom        | collapsible      |
+------------------+---------------------------+------------------+
```

### Left: thread list

New feature module: `src/features/ai/threads/` (do not grow `ChatPanel.tsx`).

- **New thread** button (full width, secondary/outline, top)
- Search/filter when list > ~8
- Rows: title (truncated), relative time, status dot (idle / running / waiting-approval / error)
- Grouping: current workspace first; later “other workspaces” can appear as a section but v1 may be single-workspace
- Replace `ChatSessionList` as the visual; keep session persistence (`useAI` / `ai` store) as the data if it already stores sessions
- Context menu: rename, delete, open in Editor (if the thread has files)

### Center: transcript + composer

Reuse restyled `Conversation`, `Message`, `ToolInvocationBlock`, `ReasoningBlock`, `AgentRunBar`, `AgentApprovals`.

**Home (no thread selected / empty workspace):** centered column, max-width ~720px, large composer (`--radius-xl`, `--shadow-sm`), short prompt “Ask Pragma to work in this folder”, recent threads underneath. Pattern: BB `RootComposeCompactHome`, not a blank Robot icon.

**Composer** (`ChatComposer.tsx`): one component for Agents center and Editor dock.

- Card: elevated, xl radius, inner padding
- Textarea unbordered inside the card
- Footer row: Ask/Agent, model, context picker, mic, send
- No gear that opens a different-looking settings island; settings stay the app Settings overlay

### Right: context pane

Tabs (text, not a second icon rail): **Review** | **Files**.

- **Review:** approvals (`AgentApprovals`), diff summary, Accept/Reject (today’s AI diff flow)
- **Files:** files the thread touched; click switches to Editor and focuses that file. No second CodeMirror in the Agents pane in v1.

Collapse control on the pane header. Persist width + collapsed in layout store.

**Default:** collapsed on home; **open** when `waiting-approval` or when diffs exist.

### v1 runtime

- Multiple threads stored, switch any time
- One agent/chat run at a time (today’s loop)
- Status dots on other threads stay idle/error from last run
- Do not start a second executor in v1

---

## Editor workspace

Keep the layout tree (`src/shell/layout/`) for splits, tabs, terminal, git panes. Restyle the chrome around it.

### Sidebar

Replace `SidebarDock` icon rail + `rounded-xl` card.

- One column `--bg-surface`, hairline separator to the editor
- **Header:** workspace name + actions (new file, collapse)
- **Body:** active view (Files / Search / Git / Git status / Debug / Docker / Processes / Extensions)
- **Footer switcher:** segmented or quiet text+icon tabs for the views above (Terax Files | Source Control). Overflow: “More” menu rather than a 10-icon stack
- `LocalHistory` stays reachable from Git or More, not a mystery dock icon

Minimum width ~220px. No 40px icon-only rail as the default; collapse is a narrow strip of the **switcher**, not a VS Code activity bar.

### Tabs, editor, terminal, git graph

Same structure, restyled:

- Tab bar uses `--radius-md` on the active tab, no Chrome-browser tabs
- `PanelHeader` height 32px, `--text-ui-sm`, consistent padding (`px-3`)
- Terminal panel chrome matches editor tabs
- Git graph keeps Terax-level density; only chrome/tokens change

### Welcome

Replace `WelcomePanel` stub: logo, short line, two actions (Open folder, New thread — the latter switches to Agents). Recents/favorites from existing settings.

---

## Component system

**All** of `src/shared/components/ui/*` plus `PanelHeader`, `PanelEmptyState` are in scope.

Rules:

1. No hardcoded hex in components (tokens only). Theme JSON is the color source.
2. Variants stay: `default | outline | secondary | ghost | destructive` — but `default` loses glow.
3. Inputs/buttons share height scale: `h-7` default, `h-6` compact (sidebar), `h-8` composer send.
4. Focus: `ring-2 ring-accent/40`, never OS blue.
5. Depth: popovers/dialogs/composer use `--shadow-sm` or `--shadow-md` + `--bg-elevated`.
6. New God files are forbidden. If `ChatPanel.tsx` or `Sidebar.tsx` would absorb the Agents shell, split modules instead.

### New / split files (expected)

| Path                                               | Role                                     |
| -------------------------------------------------- | ---------------------------------------- |
| `src/shell/chrome/ModeSwitch.tsx`                  | Agents \| Editor pill                    |
| `src/shell/mode/` or layout store field            | persisted mode                           |
| `src/features/ai/threads/`                         | list, types, store glue                  |
| `src/features/ai/components/AgentsWorkspace.tsx`   | 3-column shell                           |
| `src/features/ai/components/AgentsHome.tsx`        | empty/home composer                      |
| `src/features/ai/components/AgentsContextPane.tsx` | right Review/Files                       |
| `src/shell/chrome/Sidebar.tsx`                     | rewrite: switcher, no dock rail          |
| `src/globals.css`                                  | elevation tokens, glow removal at source |

### Settings

`Settings.tsx` already closer to the target. Align: xl radius window, same segmented/section list, no unique purple chrome. Merge **AI** and **Agent** categories into one **Agents** section after the product merge (or keep two groups inside one page). Layout settings: drop obsolete AI placement enum from the UI.

---

## Theme strategy

**Pass 1 (this rework):** signature Dark (default) + Light. Token schema gains `shadow.sm`, `shadow.md` if missing; `accent.glow` unused by buttons.

**Pass 2 (follow-up, same spec, later PRs):** Catppuccin, Tokyo Night, Nord, Gruvbox, Rose Pine, Everforest, Paper, Arctic — remap to the **same structure** (surfaces, radius, shadows). A theme may not flatten radius or restore glow. If a theme JSON cannot express a new token, extend the schema once in Pass 1.

Do not delete theme files in Pass 1; they may look slightly off until Pass 2. Document that in the PR body.

---

## Migration of existing AI

| Today                                   | After                                           |
| --------------------------------------- | ----------------------------------------------- |
| `ChatPanel` in drawer/float/tab         | Center of Agents, or Editor right dock          |
| `ChatSessionList`                       | Thread list                                     |
| `AgentPanel` as separate sidebar-ish UI | Status + steps live in transcript + Review pane |
| `ChatToolbar` Ask/Agent                 | Composer footer (keep)                          |
| `ai.mode` placements                    | `ui.mode` + optional editor dock                |
| Settings AI placement                   | Removed from UI                                 |

Keep stores (`useAI`, `useAgentStore`, session persistence). This is a shell/IA change, not a new agent runtime.

---

## Testing

- Unit: mode persist, thread list selection, context pane default open/closed, sidebar view switcher, ModeSwitch a11y (keyboard, aria-pressed).
- Existing AI tests (`ChatComposer`, `AgentRunBar`, `ToolInvocationBlock`, agent loop) must still pass.
- `pnpm run check` and `pnpm run test` on every PR.
- Visual: no screenshot snapshot library required in v1; verify in `pnpm run dev` / `dev:desktop` before claiming done. Desktop app — browser tools may not attach; use the running Tauri window.

---

## PR plan

Each PR is independently reviewable and mergeable to `main`. Label `feat` / `enhancement`.

### PR 1 — Tokens and primitives

- **Title:** `feat: unify design tokens and restyle shared UI primitives`
- **Files:** `src/globals.css`, `src/theme/themes/dark-default.json`, `src/theme/themes/light-default.json`, `src/theme/types.ts` / `validateTheme.ts` if schema grows, `src/shared/components/ui/*`, `PanelHeader.tsx`, `PanelEmptyState.tsx`
- **Deps:** none
- **Done when:** glow gone, radius/elevation used by Button/Input/Dialog/Popover/Tabs; Light + Dark token maps valid; `pnpm run check` + tests pass. App still Editor-only, but already looks calmer.

### PR 2 — Shared chrome: titlebar mode switch + quieter statusbar

- **Title:** `feat: add Agents/Editor mode switch in titlebar`
- **Files:** `Titlebar.tsx`, `ModeSwitch.tsx`, layout or settings persist, `Statusbar.tsx`, command palette commands
- **Deps:** PR 1
- **Done when:** switch toggles a mode flag; Editor body still the current layout; Agents body can be a placeholder panel with the home composer frame (no full IA yet).

### PR 3 — Editor shell: sidebar switcher, welcome

- **Title:** `feat: replace activity dock with in-sidebar view switcher`
- **Files:** `src/shell/chrome/Sidebar.tsx`, sidebar feature panels only as needed for headers, `WelcomePanel.tsx`
- **Deps:** PR 1 (PR 2 preferred)
- **Done when:** no icon rail; Files/Git/Search/… switch inside the sidebar; welcome has Open folder + New thread.

### PR 4 — Agents workspace shell

- **Title:** `feat: add three-column Agents workspace`
- **Files:** `AgentsWorkspace.tsx`, `AgentsHome.tsx`, `AgentsContextPane.tsx`, `src/features/ai/threads/*`, composer restyle
- **Deps:** PR 2
- **Done when:** Agents mode shows list | transcript | collapsible context. Can create/select threads. Run still uses existing `useAI` / agent loop.

### PR 5 — Migrate chat/agent into Agents IA

- **Title:** `feat: move chat and agent runtime into Agents workspace`
- **Files:** `ChatPanel.tsx`, `AIChatHost.tsx`, `aiPlacement.ts`, Settings Layout, `AgentPanel.tsx` (fold into transcript/review)
- **Deps:** PR 4
- **Done when:** no floating/bottom-sheet AI as primary UI; Editor can dock the active thread; old placement settings gone from UI.

### PR 6 — Settings, empty states, polish

- **Title:** `feat: align settings and empty states with the new chrome`
- **Files:** `src/features/settings/components/*`, remaining empty states, onboarding if it still looks old
- **Deps:** PR 1–5
- **Done when:** Settings matches radius/elevation; AI+Agent copy talks about Agents mode.

### PR 7 — Theme skins (follow-up)

- **Title:** `feat: remap built-in themes onto the new token structure`
- **Files:** remaining `src/theme/themes/*.json`
- **Deps:** PR 1
- **Done when:** each built-in theme keeps identity (hue) but same radius/shadow/chrome.

---

## Out of scope leftovers (do not sneak in)

- Parallel executors, worktrees UI, automations, plugin task boards (BB Tasks)
- BridgeMind named agents / routines / plugin catalog
- Redesigning git graph algorithm, docker, debug DAP
- Marketing site, new logo

---

## Open questions

None blocking v1. Deferred by decision:

- Named agents → later product spec
- Parallel runs → later runtime spec
- Theme pass 2 timing → after PR 1–6 feel solid

---

## References (paths)

- Pragma chrome: `src/shell/chrome/`, `src/shell/layout/`, `src/globals.css`
- Pragma AI: `src/features/ai/components/`, `src/features/agent/`
- Pragma UI kit: `src/shared/components/ui/`
- BB: `apps/app/src/components/{layout,sidebar,thread,promptbox}/`
- Terax: `src/modules/{header,sidebar,ai,agents}/`, `docs/*.png`
- BridgeMind: https://www.bridgemind.ai/ , https://docs.bridgemind.ai/docs
- Cursor Agents Window: https://cursor.com/docs/agent/agents-window
