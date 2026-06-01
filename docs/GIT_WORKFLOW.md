# 🌿 Git Workflow für Pragma

> Einfacher Workflow für Solo-Entwicklung ohne technischen Branch-Schutz.
> Disziplin statt Enforcement — bis das Repo public ist.

---

## Branch-Struktur

```
main          ← Stabil, nur saubere Stände
  ↑
dev           ← Aktive Entwicklung, Features sammeln sich hier
  ↑
feat/xyz      ← Ein Feature, eine Baustelle
```

---

## Workflow-Schritt für Schritt

### 1. Auf dev wechseln (oder neuen Feature-Branch starten)

```bash
git checkout dev
git pull origin dev
```

### 2. Feature-Branch erstellen

```bash
git checkout -b feat/custom-titlebar
```

**Namenskonventionen:**

- `feat/<name>` — Neues Feature
- `fix/<name>` — Bugfix
- `chore/<name>` — Tooling, Docs, Refactor
- `experiment/<name>` — Spike, Prototyp

### 3. Arbeiten & Committen

```bash
# Regelmäßig committen
git add .
git commit -m "feat: add custom titlebar with window controls"
```

**Commit-Format (Conventional Commits):**

```
feat:     Neue Feature
fix:      Bugfix
docs:     Dokumentation
style:    Formatierung, keine Code-Änderung
refactor: Code-Änderung ohne neues Feature / Fix
test:     Tests
chore:    Tooling, Dependencies, etc.
```

### 4. Feature-Branch pushen

```bash
git push -u origin feat/custom-titlebar
```

### 5. Pull Request auf GitHub erstellen

- Base: `dev`
- Compare: `feat/custom-titlebar`
- Selbst reviewen, dann mergen

### 6. In dev mergen

```bash
git checkout dev
git pull origin dev
```

### 7. dev → main (nur wenn sauber)

Wenn `dev` stabil läuft und alle Tests passen:

```bash
# Auf GitHub: PR von dev → main erstellen
# Oder lokal (nur wenn du dir sicher bist):
git checkout main
git merge dev
git push origin main
```

> ⚠️ **Regel:** `main` nur mergen wenn die App baut und läuft.

---

## Schnell-Referenz

| Was                   | Befehl                         |
| --------------------- | ------------------------------ |
| Neuer Feature-Branch  | `git checkout -b feat/name`    |
| Aktuellen Stand holen | `git pull origin dev`          |
| Branch pushen         | `git push -u origin feat/name` |
| In dev wechseln       | `git checkout dev`             |
| dev aktualisieren     | `git pull origin dev`          |
| Feature in dev mergen | Auf GitHub per PR              |
| dev in main mergen    | Nur wenn sauber — per PR       |

---

## 🚫 Nie direkt auf main pushen

Bis das Repo public ist und Branch Protection greift:

```bash
# ❌ Das nicht:
git push origin main

# ✅ Stattdessen:
git checkout dev
# oder
git checkout -b feat/...
```

---

## Wann wird public?

Phase 0 abgeschlossen — Layout, Terminal, Editor laufen.
Dann: Repo public → Branch Protection aktivieren → Workflow bleibt gleich.

---

_Stand: 2026-06-01_
