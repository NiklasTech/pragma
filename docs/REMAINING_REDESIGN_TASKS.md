# Verbleibende Aufgaben: Pragma IDE UI-Redesign

> Stand: 2026-06-16
>
> Der Großteil des Redesigns ist umgesetzt: alle 37 UI-Primitives, das globale Token-System in `src/globals.css`, das Theme-Mapping in `src/theme/applyTheme.ts`, das Theme `Pragma Dark` sowie die wichtigsten Chrome-/Layout-Komponenten. `vp check` und `vp test` laufen sauber durch.
>
> Diese Datei fasst die noch offenen Arbeiten zusammen, bevor das Redesign als vollständig gelten kann.

---

## 1. Restliche Sidebar-Panels auf neue Tokens umstellen ✅

Die folgenden Komponenten wurden auf das neue Token-System migriert:

- `src/features/sidebar/components/DockerPanel.tsx`
- `src/features/sidebar/components/LocalHistoryPanel.tsx`
- `src/features/sidebar/components/GitGraph.tsx`
- `src/features/sidebar/components/GitDiffPane.tsx`

`GitStatus.tsx` und `BranchSwitcher.tsx` wurden ebenfalls auf hartkodierte Werte geprüft und aktualisiert.

---

## 2. Settings-UI für die Statusbar-Konfiguration ✅

Die globale Statusbar (`src/shell/chrome/Statusbar.tsx`) liest ihre Konfiguration aus `useSettingsStore().statusbar`. Eine UI zum Bearbeiten wurde erstellt:

- `src/features/settings/components/StatusbarSettings.tsx`
- Eingebunden in `src/shell/chrome/Titlebar.tsx` im Settings-Sheet

UI-Elemente:

- Toggle für `statusbar.visible`
- Reorder-Buttons für aktivierte Items
- Toggle-Chips für alle verfügbaren `StatusbarItem`s
- Button „Reset to Default"

### Store-API

```ts
const { statusbar, setStatusbarSettings } = useSettingsStore();
setStatusbarSettings({ visible: false, items: ["cursor", "fileType"] });
```

---

## 3. Editor-Theme auf neue Syntax-Tokens umstellen ✅

`src/shared/lib/theme/editor-theme.ts` wurde auf die neuen CSS-Variablen umgestellt:

- `--editor-bg`
- `--editor-fg`
- `--editor-selection`
- `--editor-cursor`
- `--editor-gutter-bg`
- `--editor-gutter-fg`
- `--editor-line-active`
- `--syntax-keyword`
- `--syntax-string`
- `--syntax-comment`
- `--syntax-function`
- `--syntax-variable`
- `--syntax-number`
- `--syntax-property`
- `--syntax-type`
- `--syntax-operator`
- `--syntax-tag`
- `--syntax-attribute`

Fehlende Syntax-Variablen wurden in `src/globals.css` ergänzt.

---

## 4. File Explorer: `window.prompt` / `window.confirm` ersetzen ✅

`src/features/sidebar/components/FileExplorer.tsx` und `src/features/sidebar/components/FileTreeNode.tsx` verwenden keine Browser-Dialoge mehr.

Umgesetzt:

- `src/shared/components/ui/input-dialog.tsx` für Texteingaben
- `src/shared/components/ui/alert-dialog.tsx` für Löschen-Bestätigungen

Betroffene Aktionen:

- Neue Datei anlegen
- Neuen Ordner anlegen
- Datei/Ordner umbenennen
- Datei/Ordner löschen

---

## 5. Konsistenzprüfung: Hartkodierte Werte finden und eliminieren ✅

Alte shadcn/ui-Farbklassen in `src/features`, `src/shell` und `src/app` wurden auf das Token-System migriert. Betroffene Bereiche:

- AI-Komponenten (`src/features/ai/components/*`)
- Editor-Komponenten (`InlineDiff.tsx`, `SelectionAskAi.tsx`)
- Terminal-Komponenten (`ai-suggestions.tsx`)
- Run-Config (`RunConfigWidget.tsx`, `RunOutputPanel.tsx`)
- Settings (`AISettings.tsx`)
- Sidebar (`BranchSwitcher.tsx`, `DockerPanel.tsx`, `GitGraph.tsx`, `GitStatus.tsx`)
- Shell/Chrome (`Titlebar.tsx`)
- Shell/Layout (`AIChatHost.tsx`, `FloatingWindow.tsx`, `MarkdownPanel.tsx`, `PreviewPanel.tsx`)

Empfohlene Prüfkommandos für zukünftige Refactorings:

### Farben

```bash
# alte shadcn/ui-Farbklassen, die nicht mehr das primäre Vokabular sind
grep -R "text-muted-foreground\|text-foreground\|bg-card\|bg-muted\|bg-accent\|text-destructive\|bg-destructive\|text-primary/" src/features src/shell src/app
```

### Layout

```bash
# hartkodierte Höhen/Breiten, die durch chrome-*-Tokens ersetzt werden sollten
grep -R "h-\[40px\]\|h-\[34px\]\|h-\[28px\]\|h-\[26px\]\|w-12\|w-\[48px\]" src/features src/shell src/app
```

### Bewegung

```bash
# Durations/Easings, die nicht über --motion-* laufen
grep -R "duration-\[.*\]\|transition-all.*duration-" src/features src/shell
```

---

## 6. Sonstige offene Punkte ✅

- `src/features/ai/components/*` – geprüft und auf neue Tokens umgestellt
- `src/features/editor/components/InlineDiff.tsx`, `SelectionAskAi.tsx`, `StickyLinesOverlay.tsx` – geprüft und auf neue Tokens umgestellt
- `src/features/terminal/components/TerminalSession.tsx`, `ai-suggestions.tsx` – geprüft und auf neue Tokens umgestellt
- `src/shell/layout/components/panels/*` – geprüft und auf neue Tokens umgestellt
- `src/shell/chrome/WindowResizeHandles.tsx` – geprüft
- `.pragma-aurora-glow` und `.pragma-glass` – nicht erforderlich

---

## 7. Sticky Lines: UI aus Statusbar entfernt → spätere Settings-Seite ✅

Die **Sticky-Lines**-Funktion wurde aus der Editor-Statusbar entfernt. Der Store-Wert `useSettingsStore().editor.stickyLines` und `StickyLinesOverlay.tsx` bleiben erhalten, sind aber derzeit deaktiviert.

### Ziel (zukünftig)

- Sticky Lines als Option in einer späteren **Editor-Settings**-Seite wieder anbieten.
- `enabled` an `StickyLinesOverlay` aus der Einstellung ableiten.

### Betroffene Dateien

- `src/features/editor/components/EditorStatusbar.tsx` (Button entfernt)
- `src/features/editor/components/Editor.tsx` (`enabled={false}`)
- `src/features/editor/components/StickyLinesOverlay.tsx`
- `src/shared/stores/settings.ts` (`editor.stickyLines` bleibt erhalten)

---

## 8. Qualitäts-Checkliste vor Fertigstellung

- [x] `vp check` läuft ohne Warnungen und Fehler
- [x] `vp test` läuft erfolgreich
- [x] Keine `window.prompt` / `window.confirm` mehr im File Explorer
- [x] Keine hartkodierten Farbwerte in Feature-Komponenten
- [x] Editor-Theme reagiert auf Theme-Wechsel
- [x] Statusbar lässt sich über Settings konfigurieren
- [x] Alle Sidebar-Panels verwenden neue Tokens
- [x] Dunkles Theme sieht in allen Hauptansichten konsistent aus
