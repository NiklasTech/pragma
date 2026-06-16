# Verbleibende Aufgaben: Pragma IDE UI-Redesign

> Stand: 2026-06-16
>
> Der Großteil des Redesigns ist umgesetzt: alle 37 UI-Primitives, das globale Token-System in `src/globals.css`, das Theme-Mapping in `src/theme/applyTheme.ts`, das Theme `Pragma Dark` sowie die wichtigsten Chrome-/Layout-Komponenten. `vp check` und `vp test` laufen sauber durch.
>
> Diese Datei fasst die noch offenen Arbeiten zusammen, bevor das Redesign als vollständig gelten kann.

---

## 1. Restliche Sidebar-Panels auf neue Tokens umstellen

Die folgenden Komponenten verwenden noch überwiegend alte Klassen (`bg-card`, `text-muted-foreground`, `bg-accent`, `text-foreground`, `border-border`, `text-destructive`, `bg-muted`, …) oder hartkodierte Werte. Sie sollten auf `bg-bg-surface`, `bg-bg-root`, `bg-bg-hover`, `bg-bg-active`, `text-fg-default`, `text-fg-muted`, `text-fg-subtle`, `border-border/60`, `text-status-*` etc. migriert werden.

- `src/features/sidebar/components/DockerPanel.tsx`
- `src/features/sidebar/components/LocalHistoryPanel.tsx`
- `src/features/sidebar/components/GitGraph.tsx`
- `src/features/sidebar/components/GitDiffPane.tsx`

### Hinweis

`GitStatus.tsx` und `BranchSwitcher.tsx` wurden bereits angepasst, können aber bei Bedarf nochmals auf hartkodierte Werte geprüft werden.

---

## 2. Settings-UI für die Statusbar-Konfiguration

Die globale Statusbar (`src/shell/chrome/Statusbar.tsx`) liest ihre Konfiguration bereits aus `useSettingsStore().statusbar`, aber es gibt noch keine UI, um sie zu bearbeiten.

### Benötigte Änderungen

- `src/features/settings/components/AISettings.tsx` oder eine neue `StatusbarSettings.tsx` im selben Ordner erstellen.
- UI-Elemente:
  - Toggle für `statusbar.visible`
  - Reorder-/Checkbox-Liste der `StatusbarItem`s (`vimMode`, `cursor`, `fileType`, `encoding`, `eol`, `gitBranch`, `gitSync`, `problems`, `aiProvider`, `theme`)
  - Button „Reset to default preset“
- Die Settings-Komponente in `src/shell/chrome/Titlebar.tsx` im Settings-Sheet einbinden.

### Store-API (bereits vorhanden)

```ts
const { statusbar, setStatusbarSettings } = useSettingsStore();
setStatusbarSettings({ visible: false, items: ["cursor", "fileType"] });
```

---

## 3. Editor-Theme auf neue Syntax-Tokens umstellen

`src/shared/lib/theme/editor-theme.ts` definiert das CodeMirror-Theme. Es sollte auf die neuen CSS-Variablen aus `src/globals.css` verweisen:

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

Außerdem sollte geprüft werden, ob die im Theme JSON hinterlegten `editor.syntax.*`-Tokens korrekt ins Theme übernommen werden, damit ein Wechsel des Themes auch die Editor-Farben aktualisiert.

---

## 4. File Explorer: `window.prompt` / `window.confirm` ersetzen

`src/features/sidebar/components/FileExplorer.tsx` und `src/features/sidebar/components/FileTreeNode.tsx` verwenden Browser-Dialoge:

- `window.prompt("New file name:")`
- `window.prompt("New folder name:")`
- `window.prompt("Rename to:", node.name)`
- `window.confirm(\`Delete "\${node.name}"?\`)`

### Ziel

Eigene `Dialog`/`AlertDialog`-Komponenten aus `src/shared/components/ui/` verwenden, um ein konsistentes Erscheinungsbild zu gewährleisten und Tauri-Desktop-Verhalten zu unterstützen.

### Betroffene Aktionen

- Neue Datei anlegen
- Neuen Ordner anlegen
- Datei/Ordner umbenennen
- Datei/Ordner löschen

### Empfohlener Ansatz

Ein kleiner `InputDialog`-Wrapper erstellen (oder `AlertDialog` für Löschen), der Name und Validierung entgegennimmt.

---

## 5. Konsistenzprüfung: Hartkodierte Werte finden und eliminieren

Obwohl das Token-System jetzt zentral in `src/globals.css` liegt, können noch hartkodierte Farb-, Layout- oder Bewegungswerte in Feature-Komponenten existieren. Empfohlene Suche:

### Farben

```bash
# alte shadcn/ui-Farbklassen, die nicht mehr das primäre Vokabular sind
grep -R "text-muted-foreground\|text-foreground\|bg-card\|bg-muted\|bg-accent\|text-destructive\|bg-destructive\|text-primary/" src/features src/shell src/app
```

### Layout

```bash
# hartkodierte Höhen/Breiten, die durch chrome-*-Tokens ersetzt werden sollten
grep -R "h-\\[40px\\]\|h-\\[34px\\]\|h-\\[28px\\]\|h-\\[26px\\]\|w-12\|w-\\[48px\\]" src/features src/shell src/app
```

### Bewegung

```bash
# Durations/Easings, die nicht über --motion-* laufen
grep -R "duration-\\[.*\\]\|transition-all.*duration-" src/features src/shell
```

---

## 6. Sonstige offene Punkte

- `src/features/ai/components/Conversation.tsx`, `Message.tsx`, `ReasoningBlock.tsx`, `SourceBlock.tsx`, `ChatCodeBlock.tsx`, `MarkdownCode.tsx`, `ChatTypingIndicator.tsx`, `Shimmer.tsx`, `ActivityBlock.tsx`, `ContextPicker.tsx`, `AiModelSelector.tsx`, `ChatSessionList.tsx` prüfen und ggf. auf neue Tokens umstellen.
- `src/features/editor/components/InlineDiff.tsx`, `SelectionAskAi.tsx`, `StickyLinesOverlay.tsx` prüfen und ggf. auf neue Tokens umstellen.
- `src/features/terminal/components/TerminalSession.tsx`, `ai-suggestions.tsx` prüfen und ggf. auf neue Tokens umstellen.
- `src/shell/layout/components/panels/*` prüfen und ggf. auf neue Tokens umstellen.
- `src/shell/chrome/WindowResizeHandles.tsx` prüfen.
- Optional: `.pragma-aurora-glow` und `.pragma-glass` Utility-Klassen in `src/globals.css` definieren, falls sie noch verwendet werden sollen.

---

## 7. Qualitäts-Checkliste vor Fertigstellung

- [ ] `vp check` läuft ohne Warnungen und Fehler
- [ ] `vp test` läuft erfolgreich
- [ ] Keine `window.prompt` / `window.confirm` mehr im File Explorer
- [ ] Keine hartkodierten Farbwerte in Feature-Komponenten
- [ ] Editor-Theme reagiert auf Theme-Wechsel
- [ ] Statusbar lässt sich über Settings konfigurieren
- [ ] Alle Sidebar-Panels verwenden neue Tokens
- [ ] Dunkles Theme sieht in allen Hauptansichten konsistent aus
