# Pragma — Roadmap: Von „funktional" zu „fertig nutzbar"

> Stand: 2026-06-16
>
> Ausgangslage: Phasen 0–4 sind abgeschlossen (Foundation, Editor, VIM, Git, AI Chat, Ghost-Text, Diff/Edit, Provider). Die Basis-IDE läuft. Die verbleibenden 26 offenen Issues sind in Phase 5 (MCP & LSP), Phase 6 (Theming & Polish) und Phase 7 (Open Source Launch).
>
> Diese Roadmap ordnet die Arbeit so, dass Pragma möglichst schnell einen **Release-Ready-Zustand** erreicht, bevor die großen LSP/MCP-Arbeitspakete angegangen werden.

---

## Grundprinzip: Vertical Slices statt linearer Phasen

Statt Phase 5 komplett abzuschließen, bevor Phase 6/7 beginnt, bauen wir **Querschnitte**, die jeweils einen nutzbaren Zustand liefern:

1. **Slice 1 — Look & Feel:** Theme-System + Settings + Onboarding
2. **Slice 2 — Release-Readiness:** Docs, CI, Build-Pipeline
3. **Slice 3 — AI-Erweiterung:** MCP-Grundgerüst + Sidebar
4. **Slice 4 — Editor-Professionalisierung:** LSP selektiv
5. **Slice 5 — Open Source Launch:** README, Contributing, Plugin-SDK-Konzept

---

## Meilenstein A: Phase 6 — Theming & Polish (vorziehen!)

Ziel: Die IDE fühlt sich fertig und konfigurierbar an.

### A.1 Theme-System aufbauen

- [ ] **#63 Theme-System (JSON → CSS Variables)**
  - Theme-Format definieren (Name, Base, Colors, Fonts)
  - Loader, der JSON in `--pragma-*` CSS-Variablen übersetzt
  - `applyTheme()` erweitern oder ersetzen
  - Theme-Wechsel zur Laufzeit ohne Reload
  - Abhängigkeiten: bestehende `src/theme/applyTheme.ts`, `src/globals.css`

### A.2 Settings UI vervollständigen

- [ ] **#67 Settings UI komplett (alle Panels)**
  - Editor-Settings: VIM, Font, Tab-Size, Word-Wrap, Auto-Save
  - Terminal-Settings: Shell, Font, Scrollback, AI-Suggestions
  - AI-Settings: Provider-Konfiguration, Modelle, API-Keys, Profiles
  - Theme-Settings: Auswahl + Vorschau
  - Keyboard-Shortcuts: Übersicht (erst lesen, später editierbar)
  - Layout-Settings: Sidebar- & Panel-Größen zurücksetzen

### A.3 Built-in Themes liefern

- [ ] **#64 5 Built-in Themes**
  - `dark-default` (basiert auf aktuellem Pragma Dark)
  - `light-default`
  - `tokyo-night`
  - `catppuccin`
  - `gruvbox`

### A.4 User-Themes ermöglichen

- [ ] **#65 Theme-Loader für User-Themes**
  - Themes aus `~/.config/pragma/themes/*.json` laden
  - Validierung des JSON-Schemas
  - Fallback bei ungültigem Theme

### A.5 Keyboard-Shortcut System

- [ ] **#66 Keyboard Shortcut System (konfigurierbar)**
  - Zentrale Keymap-Registry im Frontend
  - Standard-Shortcuts für Toggle AI Chat, Toggle Terminal, Save, etc.
  - Persistenz in Settings-Store
  - Konfliktprüfung bei benutzerdefinierten Shortcuts

### A.6 Onboarding Flow

- [ ] **#68 Onboarding Flow (erster Start)**
  - Willkommensdialog beim ersten Start
  - Theme-Auswahl
  - AI-Provider einrichten (Ollama / API Key / CLI)
  - Workspace/Projekt öffnen
  - Onboarding nur einmal anzeigen, danach Flag in Tauri Store

### A.7 Native Floating Windows

- [ ] **#120 Floating Windows als native OS-Fenster nutzbar**
  - Floating Panels (Terminal, Preview, Run Output) in eigenes Tauri-Fenster auslagern
  - State-Synchronisation zwischen Hauptfenster und externem Fenster
  - Theme, Settings und Keymap im externen Fenster verfügbar
  - Fensterposition und -größe persistieren
  - Beim Schließen des externen Fensters: Panel zurück in Hauptfenster einfügen

### A.8 Fehlerbehandlung & Crash Reporting

- [ ] **#69 Fehlerbehandlung & Crash Reporting**
  - Rust: globale Error-Handler für Tauri Commands
  - Frontend: Error Boundary für React
  - User-freundliche Fehlermeldungen statt rohe Rust-Panics
  - Optionales Logging nach `~/.local/share/pragma/logs/`

### A.9 Performance-Profiling

- [ ] **#70 Performance-Profiling & Optimierung**
  - Später; nur wenn offensichtliche Probleme auftreten

---

## Meilenstein B: Phase 7 — Open Source Launch-Grundlagen

Ziel: Andere können mitmachen und die App auf allen Plattformen bauen.

### B.1 README, Contributing Guide, Code of Conduct

- [ ] **#71 README, Contributing Guide, Code of Conduct**
  - README: Was ist Pragma, Stack, Screenshots/GIF, Installationsanleitung
  - CONTRIBUTING.md: Development-Setup, Branching-Modell, PR-Checkliste
  - CODE_OF_CONDUCT.md

### B.2 CI-Pipeline

- [ ] **#72 GitHub Actions CI (macOS, Windows, Linux)**
  - Lint & Test (`vp check`, `vp test`) auf allen 3 Plattformen
  - Rust-Build-Check (`cargo check`, `cargo test`)
  - Tauri dev/build sanity check

### B.3 Release-Pipeline

- [ ] **#73 Release Pipeline (.dmg, .exe, .AppImage)**
  - GitHub Action für Cross-Platform Release-Builds
  - Code-Signing vorbereiten (später verbinden)
  - Artefakte: `.dmg`, `.exe` (MSI/NSIS), `.AppImage`

### B.4 Docs-Site

- [ ] **#74 Docs-Site (VitePress)**
  - Erst nach README/CONTRIBUTING
  - User-Docs: Installation, Features, Settings
  - Dev-Docs: Architektur, AI-Provider hinzufügen, Theme-Format

### B.5 Plugin-SDK Konzept

- [ ] **#75 Plugin-SDK Konzept in packages/**
  - Konzeptionell; erst nach stabilem Release

---

## Meilenstein C: Phase 5 — MCP (selektiv, nur Grundgerüst)

Ziel: MCP-Server sind sichtbar und AI kann erste Tools nutzen.

### C.1 MCP Server Manager

- [ ] **#52 MCP Server Manager in Rust**
  - Prozess-Lifecycle: start, stop, restart
  - Config aus `~/.config/pragma/mcp.json` lesen

### C.2 MCP JSON-RPC Client

- [ ] **#53 MCP JSON-RPC Client**
  - stdio-Kommunikation mit MCP-Servern
  - Request/Response-Mapping
  - Tool-Listing

### C.3 MCP Config + Lifecycle

- [ ] **#54 MCP Config + Server Lifecycle**
  - Persistente Config-Datei
  - Autostart-Flag
  - Health-Checks

### C.4 MCP Sidebar Panel

- [ ] **#55 MCP Sidebar Panel**
  - Liste aller konfigurierten Server
  - Status (running/stopped/error)
  - Start/Stop/Restart-Buttons
  - Log-Ansicht pro Server

### C.5 MCP Tools im AI Chat

- [ ] **#56 MCP Tools im AI Chat verfügbar machen**
  - Tool-Liste an Vercel AI SDK übergeben
  - Erste einfache Tools ausführen (z. B. filesystem)
  - Tool-Aufrufe im Chat-UI anzeigen

### C.6 Docker Branch-Hook

- [ ] **#62 Docker Branch-Hook (Compose-Änderungen erkennen)**
  - Optional; nur wenn Docker-Panel bereits läuft

---

## Meilenstein D: Phase 5 — LSP (selektiv, schrittweise)

Ziel: Der Editor bekommt echte IDE-Features, aber nicht auf einmal.

### D.1 LSP Bridge in Rust

- [ ] **#57 LSP Bridge in Rust (stdio)**
  - LSP-Server-Prozess spawnen
  - JSON-RPC über stdin/stdout
  - Initialization, Shutdown

### D.2 LSP Registry

- [ ] **#58 LSP Registry (TS, Rust, Python, ...)**
  - Bekannte Server: `typescript-language-server`, `rust-analyzer`, `pyright-langserver`, etc.
  - Auto-Detection im Workspace
  - Manual override in Settings

### D.3 LSP Completion in CodeMirror

- [ ] **#59 LSP Completion in CodeMirror**
  - Completion-Extension
  - Trigger Characters
  - Erster sichtbarer Editor-Nutzen

### D.4 LSP Diagnostics

- [ ] **#60 LSP Diagnostics (Inline Errors/Warnings)**
  - Markierungen im Editor
  - Panel/Tooltip für Details

### D.5 LSP Hover

- [ ] **#61 LSP Hover (Docs on hover)**
  - Hover-Tooltips

---

## Meilenstein E: Phase 4 — Restarbeiten

- [ ] **#51 Provider Profile (Fast/Smart/Local)**
  - Optional; kann während Meilenstein A in die AI-Settings integriert werden

---

## Empfohlene Arbeitsreihenfolge (nach und nach)

| #   | Issue(s)      | Thema                     | Dauer (geschätzt) | Ergebnis                          |
| --- | ------------- | ------------------------- | ----------------- | --------------------------------- |
| 1   | #63           | Theme-System              | 2–3 Tage          | Themes sind ladbar und wechselbar |
| 2   | #67           | Settings UI komplett      | 3–4 Tage          | Alle Settings konfigurierbar      |
| 3   | #120          | Native Floating Windows   | 3–4 Tage          | Panels als OS-Fenster nutzbar     |
| 4   | #64, #65      | Built-in + User Themes    | 2 Tage            | 5 Themes + User-Themes            |
| 5   | #66           | Keyboard Shortcuts        | 2 Tage            | Konfigurierbare Shortcuts         |
| 6   | #68           | Onboarding Flow           | 1–2 Tage          | Erster Start geführt              |
| 7   | #69           | Error Handling            | 2 Tage            | Stabile Fehlerbehandlung          |
| 8   | #71           | README + Contributing     | 1 Tag             | Open Source bereit                |
| 9   | #72           | GitHub Actions CI         | 1–2 Tage          | CI läuft auf 3 Plattformen        |
| 10  | #73           | Release Pipeline          | 2–3 Tage          | Erste Builds verfügbar            |
| 11  | #74           | Docs-Site                 | 2 Tage            | Öffentliche Dokumentation         |
| 12  | #52, #53, #54 | MCP Grundgerüst           | 4–5 Tage          | MCP-Server laufen                 |
| 13  | #55, #56      | MCP UI + Chat-Integration | 3 Tage            | MCP im UI sichtbar                |
| 14  | #57, #58      | LSP Bridge + Registry     | 4–5 Tage          | LSP-Server werden erkannt         |
| 15  | #59           | LSP Completion            | 3 Tage            | Autocomplete im Editor            |
| 16  | #60, #61      | LSP Diagnostics + Hover   | 3–4 Tage          | Volle IDE-Basics                  |
| 17  | #75           | Plugin-SDK Konzept        | 2 Tage            | Konzeptpapier                     |
| 18  | #70, #62, #51 | Polish & Nice-to-haves    | 3 Tage            | Abschluss                         |

---

## Entscheidungsregeln für diese Roadmap

1. **Phase 6 vor Phase 5:** Eine IDE ohne Settings und Themes fühlt sich unvollständig an — egal wie gut LSP/MCP funktionieren.
2. **Phase 7-Grundlagen früh:** CI und Release-Pipeline sollten nicht erst am Ende stehen, sondern parallel zu den letzten Features laufen.
3. **MCP vor LSP:** MCP ist schneller sichtbar (AI-Tools im Chat) und hat weniger Editor-Komplexität als LSP.
4. **LSP selektiv:** Nur Completion, Diagnostics, Hover. Signature Help, Go to Definition, Rename kommen später.
5. **Nur ein Issue gleichzeitig abarbeiten:** Kein paralleles Aufreißen mehrerer großer Themen.

---

## Qualitäts-Checkliste pro Meilenstein

Vor dem Weitermachen zum nächsten Meilenstein:

- [ ] `vp check` läuft ohne Fehler
- [ ] `vp test` läuft erfolgreich
- [ ] `cargo test` im `src-tauri/` Ordner läuft erfolgreich
- [ ] Manueller Smoke-Test auf der aktuellen Plattform
- [ ] Neue Docs/Settings werden aktualisiert
