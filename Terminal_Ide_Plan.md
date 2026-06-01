# Pragma — Vollständiger Projektplan

> **Projektname:** Pragma
> **Stack:** Tauri 2 · Rust · React 19 · TypeScript · Vite+ · pnpm · CodeMirror 6 · xterm.js · Vercel AI SDK · Tailwind v4 · shadcn/ui · Zustand
> **Ziel:** Leichtgewichtige, terminal-fokussierte IDE mit nativer AI-Integration, MCP-Support und vollständigem Git-Workflow
> **Rahmen:** Solo → Open Source, workspace-ready für spätere Monetarisierung

---

## 1. Vision & Prinzipien

- **Terminal-DNA ohne Terminal-Feeling:** Die App nutzt das Terminal als Kern, fühlt sich aber wie eine vollwertige IDE an — nicht wie ein aufgebohrter Terminal-Emulator
- **AI als First-Class-Citizen:** Nicht als Plugin nachträglich reingebaut, sondern von Anfang an in Architektur und UX verankert
- **Leichtgewichtig bleibt Leichtgewichtig:** Kein Electron-Overhead, Tauri hält die Binary klein (Ziel: < 15 MB)
- **Konfigurierbar bis ins Detail:** VIM-Mode, Themes, AI-Provider, MCP-Server — alles über Settings steuerbar
- **Workspace-Ready:** Single Repo jetzt, aber `packages/` Ordner vorbereitet für späteres Plugin-SDK

---

## 2. Architektur-Übersicht

```
┌─────────────────────────────────────────────────────┐
│                  React 19 Frontend                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │CodeMirror│ │ xterm.js │ │ AI Chat  │ │Sidebar │ │
│  │  Editor  │ │ Terminal │ │  Panel   │ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│         Zustand · Tailwind v4 · shadcn/ui           │
│              Vite+ (vp dev / vp build)              │
└────────────────────┬────────────────────────────────┘
                     │ Tauri Commands (IPC)
┌────────────────────▼────────────────────────────────┐
│                   Rust / Tauri 2                    │
│  ┌────────────┐ ┌─────────┐ ┌──────┐ ┌──────────┐  │
│  │portable-pty│ │MCP Mgr  │ │git2  │ │LSP Bridge│  │
│  │ PTY/Shell  │ │JSON-RPC │ │Graph │ │TS/Rust/..│  │
│  └────────────┘ └─────────┘ └──────┘ └──────────┘  │
│              Tauri Keychain (API Keys)               │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / stdio
┌────────────────────▼────────────────────────────────┐
│                  AI Provider Layer                  │
│  OpenAI · Anthropic · Ollama · Gemini · DeepSeek   │
│     Kimi · Copilot · Custom Base-URL (OpenAI-compat)│
└─────────────────────────────────────────────────────┘
```

---

## 3. Layout & UX

### 3.1 Standard-Layout (50/50 mit fester Basis)

```
┌────────────────────────────────────────────────────┐
│  [Icon] Pragma    [Tabs]           [AI] [Settings]│  ← Titlebar (Tauri custom)
├──────┬─────────────────────────┬──────────────────┤
│      │                         │                  │
│  S   │      EDITOR (50%)       │    AI CHAT       │
│  I   │    CodeMirror 6         │    PANEL         │
│  D   │    + Ghost Text         │                  │
│  E   │    + Inline Diff        │  (ein-/ausklapp- │
│  B   ├─────────────────────────┤   bar via Toggle)│
│  A   │                         │                  │
│  R   │    TERMINAL (50%)       │                  │
│      │    xterm.js             │                  │
│      │    + AI CMD Suggestions │                  │
└──────┴─────────────────────────┴──────────────────┘
```

### 3.2 Layout-Regeln

- **Default:** Editor oben, Terminal unten, 50/50 Vertical Split — aber frei per Drag & Resize verschiebbar
- **AI Chat Panel:** Rechte Seite, per Hotkey (`Cmd/Ctrl+Shift+A`) ein-/ausklappbar
- **Sidebar:** Links, ebenfalls collapsible, per Icon-Tabs navigierbar
- **Split-Engine:** `react-resizable-panels` — Panels speichern ihre Größe in Zustand (persistiert via Tauri Store)
- **Layouts speicherbar:** User kann Layouts als Preset speichern und switchen

### 3.3 Sidebar-Tabs (Icon-Navigation)

| Icon | Panel         | Inhalt                                             |
| ---- | ------------- | -------------------------------------------------- |
| 📁   | File Explorer | Dateibaum, Kontext-Menü (neu, umbenennen, löschen) |
| 🌿   | Git Graph     | Visueller Commit-Graph (git2-rs → SVG)             |
| ±    | Git Status    | Staged/Unstaged Changes, Diff-Preview              |
| 🔌   | MCP Manager   | Laufende Server, Start/Stop, Logs                  |
| 🤖   | AI Switcher   | Provider + Modell schnell wechseln                 |

---

## 4. Feature-Spezifikationen

### 4.1 Editor (CodeMirror 6)

**Kern-Extensions:**

- `@codemirror/lang-*` für alle gängigen Sprachen
- `@codemirror/vim` — VIM-Mode, per Setting togglebar
- LSP-Client Extension (custom, kommuniziert via Tauri → Rust LSP Bridge)
- Ghost-Text Extension (custom ViewPlugin für Inline AI Completion)
- Inline Diff Extension (für AI Diff/Edit Feature)

**Settings:**

```json
{
  "editor.vimMode": false,
  "editor.fontSize": 14,
  "editor.tabSize": 2,
  "editor.lineNumbers": true,
  "editor.wordWrap": false,
  "editor.theme": "custom-dark"
}
```

### 4.2 Terminal (xterm.js + portable-pty)

- Mehrere Terminal-Tabs (wie Wezterm/iTerm)
- Shell konfigurierbar (zsh, bash, fish, PowerShell)
- **Terminal AI:** Beim Tippen eines Commands kann AI Vorschläge machen (wie `Fig`/`Warp`) — per Tab akzeptieren
- Schriftart konfigurierbar (Nerd Fonts kompatibel)
- Split-Terminal (horizontal/vertikal)

### 4.3 AI Features (alle 5 Prioritäten)

#### A — Inline Ghost-Text (wie Copilot)

- CodeMirror ViewPlugin hört auf Cursor-Idle (500ms Debounce)
- Schickt Kontext (aktuelle Datei + Cursor-Position) via Tauri Command an AI Provider
- Response wird als graues Ghost-Text inline angezeigt
- Tab = akzeptieren, Escape = ablehnen
- Konfigurierbar: Debounce-Zeit, Trigger-Zeichen, Provider

#### B — AI Chat Panel

- Vercel AI SDK `useChat` Hook
- **Codebase-aware:** User kann Dateien/Ordner per `@filename` referenzieren
- Rust-Backend liest Dateiinhalt und fügt ihn als Kontext ein
- Streaming-Response mit Markdown-Rendering + Code-Highlighting
- Chat-History persistiert per Session (Tauri Store)

#### C — Terminal AI (Command Suggestions)

- xterm.js Input-Hook fängt Typing ab
- Kontextuell: weiß welches Verzeichnis, welche Sprache im Editor, letzter Output
- Suggestions erscheinen als Overlay über dem Terminal-Input
- Provider: Separates leichtgewichtiges Modell konfigurierbar (z.B. lokal via Ollama)

#### D — Codebase-aware Chat

- Rust-Backend: File-Walker der Repository-Struktur indiziert
- Embedding optional (lokal via Ollama `nomic-embed-text` oder remote)
- Ohne Embedding: Relevante Dateien per Fuzzy-Match + explizite `@`-Referenzen
- Mit Embedding: Semantische Suche über Codebase (Phase 2)

#### E — AI Diff/Edit (Code direkt ändern)

- User markiert Code-Block im Editor → "Edit with AI" Kontextmenü
- Chat-Input öffnet sich mit Pre-filled-Prompt
- AI Response wird als Diff angezeigt (Editor Split: Links Original, Rechts Vorschlag)
- Accept/Reject per Button oder Hotkey
- Basiert auf Inline-Diff Extension im Editor

### 4.4 Git Integration (git2-rs)

**Git Graph (Sidebar):**

- `git2` Crate liest Repository-History
- Rust wandelt in Graph-Datenstruktur um (Nodes = Commits, Edges = Parent-Beziehungen)
- JSON via Tauri Command an Frontend
- React rendert als SVG (ähnlich wie GitLens oder SourceTree)
- Branches farbcodiert, HEAD hervorgehoben
- Click auf Commit → Commit-Details (Message, Files, Diff)

**Git Status:**

- Staged/Unstaged Files Liste
- Inline-Diff Preview beim Hover
- Stage/Unstage per Button
- Commit-Eingabe direkt in der Sidebar
- Push/Pull Buttons mit Progress-Indicator

### 4.5 MCP Server Manager

**Konzept:**

- MCP-Server sind externe Prozesse, die per JSON-RPC kommunizieren
- Rust-Backend managed den Lifecycle (start, stop, restart, health-check)
- Konfiguration in `~/.config/pragma/mcp.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
      "autostart": true
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${keychain:github_token}" },
      "autostart": false
    }
  ]
}
```

- MCP-Tools werden dem AI Chat Panel automatisch als verfügbare Tools übergeben
- Sidebar zeigt Status (grün/rot), Logs per Klick

### 4.6 AI Provider System

**Provider-Abstraktion (Rust Trait):**

```rust
trait AIProvider: Send + Sync {
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionResponse>;
    async fn stream(&self, req: CompletionRequest) -> Result<Stream<CompletionChunk>>;
    fn models(&self) -> Vec<ModelInfo>;
}
```

**Unterstützte Provider (v1.0):**

| Provider        | Auth      | Protokoll     | Modelle                      |
| --------------- | --------- | ------------- | ---------------------------- |
| OpenAI          | API Key   | REST          | gpt-4o, o1, o3               |
| Anthropic       | API Key   | REST          | claude-opus-4, sonnet, haiku |
| Ollama          | — (lokal) | REST          | alle lokalen Modelle         |
| Google Gemini   | API Key   | REST          | gemini-2.0-flash, pro        |
| DeepSeek        | API Key   | OpenAI-compat | deepseek-chat, coder         |
| Kimi (Moonshot) | API Key   | OpenAI-compat | moonshot-v1-\*               |
| GitHub Copilot  | OAuth     | REST          | copilot                      |
| Custom          | API Key   | OpenAI-compat | konfigurierbar               |

**Wichtig:** Alle OpenAI-kompatiblen Anbieter (DeepSeek, Kimi, Groq, Together, etc.) laufen über den "Custom"-Provider mit konfigurierbarer Base-URL — kein separater Code nötig.

**AI Switcher (Sidebar):**

- Quick-Switch zwischen Provider + Modell
- Verschiedene Profile für verschiedene Tasks (z.B. "Fast" = Haiku local, "Smart" = Claude Sonnet)
- API Keys sicher via Tauri Keychain (nicht im Klartext in Config)

### 4.7 Theming

**System:**

- Tailwind v4 CSS Custom Properties als Token-System
- Theme = JSON-Datei mit Farb- und Font-Definitionen
- Werden zur Laufzeit als CSS Variables injiziert
- CodeMirror und xterm.js bekommen Theme-Updates via deren eigenes API

**Theme-Format:**

```json
{
  "name": "Tokyo Night",
  "base": "dark",
  "colors": {
    "background": "#1a1b26",
    "foreground": "#c0caf5",
    "accent": "#7aa2f7",
    "terminal.background": "#1a1b26",
    "editor.cursor": "#c0caf5",
    "git.added": "#9ece6a",
    "git.modified": "#e0af68",
    "git.deleted": "#f7768e"
  },
  "fonts": {
    "editor": "JetBrains Mono",
    "terminal": "JetBrains Mono",
    "ui": "Inter"
  }
}
```

- Built-in Themes: `dark-default`, `light-default`, `tokyo-night`, `catppuccin`, `gruvbox`
- User kann eigene Themes als JSON-Dateien in Config-Ordner legen
- Theme-Editor in Settings (visuell, ohne JSON editieren zu müssen) — Phase 2

### 4.8 VIM Mode

- `@codemirror/vim` Extension
- Per Settings-Toggle aktivierbar: `editor.vimMode: true/false`
- Statusbar zeigt aktuellen VIM-Mode (INSERT / NORMAL / VISUAL)
- Erweiterte VIM-Config (custom keymaps) in Settings möglich
- `:w` und `:wq` mapped auf Tauri Save-Command

---

## 5. Repo-Struktur

```
pragma/
├── src/                          # React Frontend
│   ├── components/
│   │   ├── editor/
│   │   │   ├── Editor.tsx        # CodeMirror Wrapper
│   │   │   ├── extensions/
│   │   │   │   ├── ghost-text.ts # Inline AI Completion
│   │   │   │   ├── lsp.ts        # LSP Client
│   │   │   │   └── inline-diff.ts
│   │   │   └── vim-status.tsx
│   │   ├── terminal/
│   │   │   ├── Terminal.tsx      # xterm.js Wrapper
│   │   │   ├── TerminalTabs.tsx
│   │   │   └── ai-suggestions.tsx
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── GitGraph.tsx      # SVG Graph-Rendering
│   │   │   ├── GitStatus.tsx
│   │   │   ├── McpManager.tsx
│   │   │   └── AiSwitcher.tsx
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── ContextPicker.tsx # @filename Referenzen
│   │   ├── layout/
│   │   │   ├── Layout.tsx        # react-resizable-panels
│   │   │   └── Titlebar.tsx
│   │   └── settings/
│   │       ├── Settings.tsx
│   │       ├── AISettings.tsx
│   │       ├── ThemeSettings.tsx
│   │       └── McpSettings.tsx
│   ├── stores/
│   │   ├── editor.ts             # Zustand: Editor State
│   │   ├── terminal.ts           # Zustand: Terminal Sessions
│   │   ├── ai.ts                 # Zustand: AI Provider/Model
│   │   ├── layout.ts             # Zustand: Panel Sizes
│   │   └── settings.ts           # Zustand: All Settings
│   ├── hooks/
│   │   ├── useAI.ts              # Vercel AI SDK Wrapper
│   │   ├── useLSP.ts
│   │   ├── useMCP.ts
│   │   └── useGit.ts
│   ├── lib/
│   │   ├── providers/            # AI Provider Configs
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   ├── ollama.ts
│   │   │   └── custom.ts
│   │   └── theme/
│   │       ├── loader.ts
│   │       └── builtin/          # Built-in Theme JSONs
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── pty.rs            # Terminal Commands
│   │   │   ├── git.rs            # Git Commands
│   │   │   ├── lsp.rs            # LSP Commands
│   │   │   ├── mcp.rs            # MCP Commands
│   │   │   ├── ai.rs             # AI Proxy Commands
│   │   │   └── fs.rs             # File System Commands
│   │   ├── mcp/
│   │   │   ├── manager.rs        # Process Lifecycle
│   │   │   └── client.rs         # JSON-RPC Client
│   │   ├── git/
│   │   │   ├── graph.rs          # Commit Graph Builder
│   │   │   └── status.rs
│   │   ├── lsp/
│   │   │   ├── bridge.rs         # stdio LSP Bridge
│   │   │   └── registry.rs       # Known LSP Servers
│   │   └── ai/
│   │       ├── provider.rs       # Trait + Registry
│   │       └── keychain.rs       # Secure Key Storage
│   └── Cargo.toml
├── packages/                     # Leer — für Plugin-SDK (Phase 3)
├── vite.config.ts
├── vite-plus.config.ts           # Vite+ Config
├── tailwind.config.ts
├── package.json
└── pnpm-workspace.yaml
```

---

## 6. Technologie-Entscheidungen im Detail

### Warum `react-resizable-panels`?

- Aktiv maintained, TypeScript-first
- Unterstützt kollabierbare Panels nativ
- Panel-Größen als Prozent — funktioniert bei jedem Window-Resize korrekt
- Keyboard-accessible (Accessibility out of the box)

### Warum `git2` (Rust) statt Shell-Git?

- Kein externes `git` Binary nötig → funktioniert auch auf Systemen ohne git im PATH
- Direkte API → kein Output-Parsing, kein Injection-Risiko
- Deutlich schneller für Graph-Operationen auf großen Repos

### Warum Vercel AI SDK?

- Provider-agnostisch: OpenAI, Anthropic, Ollama alle mit gleichem Interface
- Streaming out of the box (`useChat`, `useCompletion`)
- Tool-Calling / MCP-Integration ist eingebaut
- React Hooks die perfekt in Zustand-State-Flow passen

### Warum `portable-pty` statt eigenem PTY?

- Cross-Platform (macOS, Windows, Linux) ohne ifdefs
- Bewährt in terax-ai, Zed, anderen Rust-Terminal-Apps
- Korrekte ANSI-Escape-Handling inklusive

---

## 7. Phasen-Plan

### Phase 0 — Foundation (Woche 1–2)

**Ziel:** Laufende App, beide Kern-Panels funktionieren

- [ ] Vite+ Setup (`vp create`, Tauri 2 integrieren)
- [ ] pnpm Workspace vorbereiten
- [ ] Tailwind v4 + shadcn/ui konfigurieren
- [ ] Zustand Stores anlegen (leer, nur Struktur)
- [ ] Custom Titlebar (Tauri `decorations: false`)
- [ ] Layout mit `react-resizable-panels` (Editor + Terminal Panels)
- [ ] xterm.js Terminal mit portable-pty verbinden
- [ ] CodeMirror 6 Editor (ohne Extensions) einbinden
- [ ] Basis File-Open (Tauri `fs` API)

**Deliverable:** App öffnet, Terminal funktioniert, Datei kann geöffnet und bearbeitet werden

---

### Phase 1 — Editor & VIM (Woche 3–4)

**Ziel:** Vollwertiger Editor

- [ ] CodeMirror Language-Support (20+ Sprachen)
- [ ] VIM Mode (`@codemirror/vim`) + Settings-Toggle
- [ ] VIM-Statusbar
- [ ] Syntax Highlighting (CodeMirror Themes)
- [ ] File Explorer Sidebar (git2-freier Dateibaum)
- [ ] Multi-Tab Editor
- [ ] File Save / Auto-Save
- [ ] `vp check` Integration (Oxlint läuft sauber)

---

### Phase 2 — Git (Woche 5–6)

**Ziel:** Vollständiger Git-Workflow ohne Terminal

- [ ] git2-rs Crate einbinden
- [ ] Commit-Graph Builder in Rust
- [ ] Git Graph SVG-Renderer in React
- [ ] Git Status Panel (staged/unstaged)
- [ ] Stage/Unstage/Commit UI
- [ ] Inline Diff Preview
- [ ] Branch-Switching
- [ ] Push/Pull (mit Auth via Keychain)

---

### Phase 3 — AI Foundation (Woche 7–9)

**Ziel:** AI Chat + erste Provider funktionieren

- [ ] AI Provider Trait in Rust
- [ ] OpenAI + Anthropic + Ollama implementieren
- [ ] Tauri Keychain für API-Keys
- [ ] AI Settings UI (Key eingeben, Provider wählen)
- [ ] AI Chat Panel mit Vercel AI SDK
- [ ] Streaming Response + Markdown-Rendering
- [ ] Codebase-Context: `@filename` Referenzen
- [ ] AI Switcher Sidebar-Panel

---

### Phase 4 — AI Advanced (Woche 10–12)

**Ziel:** Alle 5 AI-Features live

- [ ] Inline Ghost-Text (CodeMirror ViewPlugin)
- [ ] Ghost-Text Debounce + Accept/Reject
- [ ] Terminal AI Command Suggestions
- [ ] AI Diff/Edit (Split-Diff + Accept/Reject)
- [ ] DeepSeek, Kimi, Gemini, Custom-Base-URL Provider
- [ ] GitHub Copilot OAuth Flow
- [ ] Provider-Profile (Fast/Smart/Local)

---

### Phase 5 — MCP & LSP (Woche 13–15)

**Ziel:** MCP-Server und LSP-Completion

- [ ] MCP Server Manager in Rust
- [ ] MCP Config (JSON), Server Start/Stop/Restart
- [ ] MCP Tools im AI Chat verfügbar
- [ ] MCP Sidebar Panel (Status + Logs)
- [ ] LSP Bridge in Rust (TypeScript, Rust-Analyzer, Pyright)
- [ ] LSP Completion in CodeMirror
- [ ] LSP Diagnostics (Inline Errors/Warnings)
- [ ] LSP Hover (Docs on hover)

---

### Phase 6 — Theming & Polish (Woche 16–17)

**Ziel:** Release-Ready

- [ ] Theme-System (JSON → CSS Variables)
- [ ] 5 Built-in Themes
- [ ] Theme-Loader für User-Themes
- [ ] Keyboard-Shortcut System (konfigurierbar)
- [ ] Settings UI komplett (alle Panels)
- [ ] Onboarding (erster Start: Provider einrichten)
- [ ] Fehlerbehandlung & Crash-Reporting
- [ ] Performance-Profiling (großes Repo, viele Tabs)

---

### Phase 7 — Open Source Launch (Woche 18+)

- [ ] README, Contributing Guide, Code of Conduct
- [ ] GitHub Actions CI (alle 3 Plattformen)
- [ ] Release-Pipeline (`.dmg`, `.exe`, `.AppImage`)
- [ ] Docs-Site (VitePress — passt zum Vite+ Stack)
- [ ] Plugin-SDK Konzept in `packages/`

---

## 8. Kritische Abhängigkeiten & Risiken

| Risiko                                      | Wahrscheinlichkeit | Mitigation                                            |
| ------------------------------------------- | ------------------ | ----------------------------------------------------- |
| Windows PTY-Quirks (ConPTY)                 | Mittel             | portable-pty handled das, frühzeitig testen           |
| LSP-Bridge Performance bei großen Projekten | Mittel             | Lazy-Start, nur bei Bedarf spawnen                    |
| Copilot OAuth Token-Refresh                 | Hoch               | Separates Auth-Modul, gut dokumentiert testen         |
| CodeMirror + VIM + LSP Extension-Konflikte  | Mittel             | terax-ai als Referenz, Extension-Order beachten       |
| Tauri 2 Breaking Changes                    | Niedrig            | Version pinnen, Changelog verfolgen                   |
| Vite+ Alpha-Stabilität                      | Mittel             | Vite+ ist in Alpha — Fallback auf reines Vite möglich |

---

## 9. Settings-Struktur (Vollständig)

```json
{
  "editor": {
    "vimMode": false,
    "fontSize": 14,
    "fontFamily": "JetBrains Mono",
    "tabSize": 2,
    "insertSpaces": true,
    "wordWrap": false,
    "lineNumbers": true,
    "autoSave": "onFocusChange",
    "formatOnSave": false
  },
  "terminal": {
    "shell": "/bin/zsh",
    "fontSize": 13,
    "fontFamily": "JetBrains Mono",
    "aiSuggestions": true,
    "scrollback": 10000
  },
  "ai": {
    "defaultProvider": "anthropic",
    "defaultModel": "claude-sonnet-4-6",
    "inlineCompletion": true,
    "completionDebounce": 500,
    "terminalSuggestions": true,
    "providers": {
      "openai": { "model": "gpt-4o" },
      "anthropic": { "model": "claude-sonnet-4-6" },
      "ollama": { "baseUrl": "http://localhost:11434", "model": "llama3.2" },
      "deepseek": { "baseUrl": "https://api.deepseek.com", "model": "deepseek-chat" },
      "kimi": { "baseUrl": "https://api.moonshot.cn/v1", "model": "moonshot-v1-8k" },
      "custom": { "baseUrl": "", "model": "" }
    }
  },
  "theme": "dark-default",
  "keymap": "default",
  "layout": {
    "sidebarWidth": 250,
    "terminalHeight": "50%",
    "chatPanelWidth": 380
  }
}
```

---

## 10. Tooling-Befehle (Vite+ / pnpm)

```bash
# Installation & Setup
curl -fsSL https://vite.plus | bash    # vp global installieren
vp create                              # Projekt erstellen
vp install                             # Dependencies

# Development
vp dev                                 # Frontend nur (Vite HMR)
vp run tauri:dev                       # Volle Tauri App
vp check                               # Oxlint + Oxfmt + TypeCheck
vp test                                # Vitest

# Build
vp run tauri:build                     # Release Build (alle Plattformen via CI)
vp build                               # Frontend Build only

# Dependency Management
vp add react-resizable-panels         # Package hinzufügen
vp remove <package>
vp outdated                            # Veraltete Packages anzeigen
```

---

_Stand: Initiale Planung · Wird iterativ aktualisiert_

---

## 11. JetBrains-inspirierte Features

### 11.1 Smart Checkout (Branch-Switch)

Beim Branch-Wechsel über die Pragma-UI passiert folgendes automatisch:

```
User klickt Branch → Pragma erkennt uncommitted Changes
  ↓
Dialog: "Du hast 3 geänderte Dateien"
  → [Smart Switch]   Auto-stash → checkout → auto-unstash + Workspace restore
  → [Normaler Switch] Einfach checkout (Changes bleiben, kann zu Konflikten führen)
  → [Abbrechen]
```

**Workspace Restore pro Branch:**

- Welche Dateien offen waren (Editor-Tabs)
- Cursor-Position pro Datei
- Aktive Run-Konfiguration
- Terminal-Verzeichnis
- Split-Layout

Alles wird pro Branch in Tauri Store gespeichert und beim Zurückwechseln exakt wiederhergestellt.

**Implementierung:**

- `git2` für Branch-Checkout + Stash-Operationen
- Zustand-Snapshot wird vor Checkout serialisiert → `~/.config/pragma/workspaces/<repo-hash>/<branch-name>.json`
- Nach Checkout: Snapshot laden und Zustand wiederherstellen

---

### 11.2 Run Configurations (Task-Widget)

Definierbare, benannte Tasks die per Klick oder Hotkey gestartet werden — direkt in der Titlebar sichtbar.

**Konfiguration in `.pragma/run.json` im Projekt:**

```json
{
  "configurations": [
    {
      "name": "Dev Server",
      "icon": "▶",
      "command": "pnpm dev",
      "cwd": "${workspaceRoot}",
      "env": { "NODE_ENV": "development" },
      "autostart": false
    },
    {
      "name": "Build",
      "icon": "🔨",
      "command": "cargo build --release",
      "cwd": "${workspaceRoot}/src-tauri"
    },
    {
      "name": "Tests",
      "icon": "✓",
      "command": "vp test",
      "cwd": "${workspaceRoot}"
    },
    {
      "name": "Docker Up",
      "icon": "🐳",
      "command": "docker compose up -d",
      "cwd": "${workspaceRoot}"
    }
  ]
}
```

**Titlebar-Widget:**

```
[Pragma]  [main ▾]  [▶ Dev Server ■]  [🔨 Build]  [✓ Tests]   ··· [AI] [⚙]
                     ↑ läuft gerade    ↑ click to run
```

- Laufende Prozesse zeigen Status-Indikator (grün = running, rot = failed, grau = stopped)
- Output streamt direkt in ein dediziertes Terminal-Tab
- Stop/Restart per Klick
- Mehrere Configs können gleichzeitig laufen

---

### 11.3 Local History

Automatische Versionierung aller Datei-Änderungen — unabhängig von Git. Kein Commit nötig.

**Wie es funktioniert:**

- Rust File-Watcher (via `notify` crate) beobachtet alle offenen/geänderten Dateien
- Bei jeder Speicherung wird ein Snapshot in `~/.local/share/pragma/history/<repo-hash>/` gespeichert
- Komprimiert (nur Diffs, nicht ganze Dateien)
- Retention: 30 Tage oder 500 Snapshots pro Datei (konfigurierbar)

**UI:**

- Rechtsklick auf Datei im Explorer → "Local History anzeigen"
- Timeline-View: Liste aller Snapshots mit Timestamp
- Diff-Preview beim Hover
- Wiederherstellen per Klick (einzelne Änderung oder ganzer Snapshot)

**Besonders nützlich wenn:**

- Änderungen vor dem ersten Commit verloren gehen
- Man `git checkout .` gemacht hat und es bereut
- Man sehen will was man vor 2 Stunden hatte

---

### 11.4 Docker Integration

**Crate:** `bollard` — asynchrone Docker/Podman API, Cross-Platform (Unix Socket + Windows Named Pipe)

**Sidebar-Panel: Docker-Tab**

```
🐳 DOCKER

  CONTAINERS
  ● api-service        running  ↗ Logs  ■ Stop
  ● postgres-db        running  ↗ Logs  ■ Stop
  ○ redis-cache        stopped          ▶ Start
  ● nginx-proxy        running  ↗ Logs  ■ Stop

  COMPOSE (docker-compose.yml gefunden)
  [▶ Up]  [■ Down]  [↺ Restart]  [🔨 Build]

  IMAGES
  myapp:latest         245 MB   2h ago
  postgres:16          89 MB    3d ago
```

**Features im Detail:**

| Feature            | Was es macht                                        |
| ------------------ | --------------------------------------------------- |
| Container-Liste    | Alle laufenden + gestoppten Container, live Status  |
| Start/Stop/Restart | Per Klick, kein Terminal nötig                      |
| Logs               | Streaming Logs direkt in Pragma Terminal-Tab        |
| Exec               | Shell in Container öffnen (→ neuer Terminal-Tab)    |
| Docker Compose     | Up/Down/Build/Restart für ganzes Compose-File       |
| Stats              | CPU + Memory Usage pro Container (optional, Toggle) |
| Branch-Hook        | Beim Branch-Switch: optional Container neu bauen    |

**Branch-Switch + Docker (die Killer-Kombination):**

```
Branch wechsel zu "feature/new-db-schema"
  → Pragma erkennt: docker-compose.yml hat sich geändert
  → Fragt: "docker-compose.yml geändert — Container neu bauen?"
    → [Ja, neu bauen]  docker compose up --build -d
    → [Nein]           Weiter ohne rebuild
```

**Implementierung (Rust):**

```rust
// bollard via Unix Socket (macOS/Linux) oder Named Pipe (Windows)
// Automatische Erkennung welches verfügbar ist
let docker = Docker::connect_with_local_defaults()?;

// Container-Liste mit Live-Updates via Event-Stream
docker.list_containers(...)
docker.stats(container_id, ...)  // CPU/Memory Stream
docker.logs(container_id, ...)   // Log Stream → Terminal Tab
docker.exec(container_id, ...)   // Shell öffnen
```

**Podman Support:** bollard unterstützt Podman nativ als Drop-In — kein extra Code nötig, nur Socket-Pfad anders.

**Nicht in Scope (zu komplex für v1):**

- Docker Desktop GUI-Replacement
- Kubernetes Integration (eigenes Feature, Phase 4+)
- Image Builder UI
- Registry Push/Pull UI (aber per Run-Config möglich)

---

### 11.5 Sticky Lines (Bonus — kleines aber feines JetBrains-Feature)

CodeMirror 6 hat eine `stickyLines` Extension die beim Scrollen den übergeordneten Kontext (aktuelle Klasse / Funktion / Block) oben im Editor sichtbar hält. Einzeiliger Toggle in Settings:

```json
{ "editor.stickyLines": true }
```

Kostet praktisch nichts (eine CodeMirror Extension), macht aber einen spürbaren Unterschied bei großen Dateien.

---

## 12. Aktualisierte Phasen (mit neuen Features)

| Phase   | Neu hinzugekommen                                             |
| ------- | ------------------------------------------------------------- |
| Phase 1 | Run Configurations Widget + Sticky Lines                      |
| Phase 2 | Smart Checkout + Workspace Restore per Branch + Local History |
| Phase 3 | Docker Integration (bollard)                                  |
| Phase 5 | Docker Branch-Hook (Compose-Änderungen erkennen)              |
