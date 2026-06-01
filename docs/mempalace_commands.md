# 🏛️ MemPalace Spickzettel (Cheat Sheet)

Dieses Dokument enthält alle wichtigen Befehle für die Arbeit mit dem MemPalace Gedächtnis-System im **Pragma**-Projekt.

---

## 🛠️ Setup & Initialisierung

| Befehl                      | Beschreibung                                                                                              |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `mempalace init .`          | Initialisiert das aktuelle Verzeichnis als neuen **Wing** (Flügel). Scannt Dateien und schlägt Räume vor. |
| `mempalace init . --no-llm` | Initialisierung ohne lokale KI (Ollama). Nutzt Heuristiken zur Erkennung.                                 |
| `mempalace mcp`             | Zeigt die Konfigurationsdaten für MCP-Clients (Claude, Kimi, Cursor) an.                                  |

## ⛏️ Datenverarbeitung (Mining)

| Befehl                   | Beschreibung                                                                                 |
| :----------------------- | :------------------------------------------------------------------------------------------- |
| `mempalace mine .`       | Indiziert alle Dateien im aktuellen Verzeichnis und speichert sie im Palast.                 |
| `mempalace sweep <pfad>` | Verarbeitet Konversations-Transkripte (z. B. von Claude Code) und speichert sie als Drawers. |
| `mempalace status`       | Zeigt eine Übersicht über den aktuellen Palast, die installierten Wings und Räume.           |

## 🔍 Suche (Manuell)

| Befehl                                     | Beschreibung                                             |
| :----------------------------------------- | :------------------------------------------------------- |
| `mempalace search "Begriff"`               | Startet eine semantische Suche über den gesamten Palast. |
| `mempalace search "Begriff" --wing pragma` | Sucht nur innerhalb des Pragma-Projekts (Wings).         |

## 🧠 MCP Tools (Für Kimi / Claude / IDE)

Die KI nutzt diese Befehle automatisch im Hintergrund. Du kannst sie aber auch gezielt dazu auffordern:

- **`mempalace_status`**: Übersicht über das gesamte Gedächtnis laden.
- **`mempalace_search`**: Semantische Suche nach Code oder Konzepten.
- **`mempalace_get_drawer`**: Den exakten Inhalt einer "Schublade" (Datei/Notiz) lesen.
- **`mempalace_kg_query`**: Den Knowledge Graph nach Beziehungen zwischen Entitäten abfragen.
- **`mempalace_diary_write`**: Kimi anweisen, eine Zusammenfassung der aktuellen Session zu speichern.

## 📁 Wichtige Pfade

- **Konfiguration:** `~/Schreibtisch/Coding/pragma/mempalace.yaml`
- **Lokale Datenbank:** `~/.mempalace/palace`
- **MCP Executable:** `/home/niklash/.local/bin/mempalace-mcp`

## 🏗️ Projekt: Pragma

| Eigenschaft | Wert                                                                |
| :---------- | :------------------------------------------------------------------ |
| **Stack**   | Tauri 2 · Rust · React 19 · TypeScript · Vite+ · pnpm · Tailwind v4 |
| **Wing**    | `pragma`                                                            |
| **Räume**   | `src`, `src_tauri`, `public`, `documentation`, `general`            |
| **Plan**    | `docs/PLAN.md` — Vollständiger Projektplan mit Phasen & Architektur |

### Vite+ Befehle (für Pragma)

```bash
vp dev              # Frontend Dev-Server
vp run tauri:dev    # Volle Tauri App
vp check            # Oxlint + Oxfmt + TypeCheck
vp test             # Vitest
vp run tauri:build  # Release Build
```

---

_Tipp: Führe `mempalace mine .` nach jeder größeren Änderung im Code aus, damit dein KI-Gedächtnis aktuell bleibt._
